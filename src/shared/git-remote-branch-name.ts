export function splitRemoteBranchName(refName: string): {
  remoteName: string
  branchName: string
} | null {
  const slashIndex = refName.indexOf('/')
  if (slashIndex <= 0 || slashIndex === refName.length - 1) {
    return null
  }
  return {
    remoteName: refName.slice(0, slashIndex),
    branchName: refName.slice(slashIndex + 1)
  }
}

export function gitRefTargetsBranchName(
  refName: string | null | undefined,
  branchName: string
): boolean {
  const trimmed = refName?.trim()
  if (!trimmed || !branchName) {
    return false
  }
  const headsPrefix = 'refs/heads/'
  if (trimmed.startsWith(headsPrefix)) {
    return trimmed.slice(headsPrefix.length) === branchName
  }
  const remotesPrefix = 'refs/remotes/'
  if (trimmed.startsWith(remotesPrefix)) {
    return splitRemoteBranchName(trimmed.slice(remotesPrefix.length))?.branchName === branchName
  }
  return trimmed === branchName || splitRemoteBranchName(trimmed)?.branchName === branchName
}
