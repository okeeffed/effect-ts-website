import React from "react"
import { WorkspaceHandle } from "../rx/workspace"

export const WorkspaceContext = React.createContext<WorkspaceHandle>(
  null as any
)

export const useWorkspaceHandle = () => {
  return React.useContext(WorkspaceContext)
}

export const useWorkspace = () => useWorkspaceHandle().workspace
