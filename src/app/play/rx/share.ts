import { WorkspaceHandle } from "@/CodeEditor/rx/workspace"
import { File, Workspace, WorkspaceShell } from "@/domain/Workspace"
import { tutorialsPackageJson } from "@/tutorials/common"
import { Result, Rx } from "@effect-rx/rx-react"
import { Clipboard } from "@effect/platform-browser"
import { Effect, Layer } from "effect"
import { WorkspaceCompression } from "../services/WorkspaceCompression"
import { editorRx } from "@/CodeEditor/rx/editor"
import { hashRx } from "@/rx/location"

const runtime = Rx.runtime(
  Layer.mergeAll(WorkspaceCompression.Live, Clipboard.layer)
)

export const shareRx = Rx.family(({ handle, workspace }: WorkspaceHandle) => {
  const state = Rx.make<"idle" | "loading" | "success">("idle")
  const share = runtime.fn((_: void, get) =>
    Effect.gen(function* () {
      get.setSync(state, "loading")

      const compression = yield* WorkspaceCompression
      const editor = yield* Result.toExit(
        get.once(editorRx(workspace).editor)
      )

      yield* editor.save

      const hash = yield* compression.compress(
        workspace,
        `playground-${Date.now()}`,
        handle.read
      )
      const url = new URL(location.href)
      url.hash = hash
      const urlString = url.toString()

      get.setSync(state, "success")

      yield* Effect.sleep(2000).pipe(
        Effect.andThen(get.set(state, "idle")),
        Effect.forkScoped
      )

      return urlString
    }).pipe(
      Effect.tapErrorCause((cause) => {
        get.setSync(state, "idle")
        return Effect.log(cause)
      })
    )
  )
  return { state, share } as const
})

const defaultWorkspace = new Workspace({
  name: "playground",
  prepare: "npm install",
  shells: [new WorkspaceShell({ command: "../run main.ts" })],
  initialFilePath: "main.ts",
  snapshot: "tutorials",
  tree: [
    tutorialsPackageJson,
    new File({
      name: "main.ts",
      initialContent: `import { Effect } from "effect"

Effect.gen(function* () {
  yield* Effect.log("Welcome to the Effect Playground!")
}).pipe(Effect.runPromise)
`
    })
  ]
})

export const importRx = runtime.rx((get) =>
  Effect.gen(function* () {
    const hash = get(hashRx)
    if (hash._tag === "None") return defaultWorkspace
    const compression = yield* WorkspaceCompression
    return yield* compression
      .decompress({
        shells: [new WorkspaceShell({ command: "../run main.ts" })],
        initialFilePath: "main.ts",
        whitelist: ["package.json", "main.ts"],
        compressed: hash.value
      })
      .pipe(Effect.orElseSucceed(() => defaultWorkspace))
  })
)
