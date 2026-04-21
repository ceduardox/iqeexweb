const FAILED_ORG_LOGO_PREFIX = 'lh:failed-org-logo:'

function getFailedOrgLogoKey(orgUUID?: string, fileId?: string, version?: string) {
  if (!orgUUID || !fileId) {
    return null
  }

  const normalizedVersion = version || 'unknown'
  return `${FAILED_ORG_LOGO_PREFIX}${orgUUID}:${fileId}:${normalizedVersion}`
}

export function hasFailedOrgLogo(orgUUID?: string, fileId?: string, version?: string) {
  if (typeof window === 'undefined') {
    return false
  }

  const key = getFailedOrgLogoKey(orgUUID, fileId, version)
  if (!key) {
    return false
  }

  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function rememberFailedOrgLogo(orgUUID?: string, fileId?: string, version?: string) {
  if (typeof window === 'undefined') {
    return
  }

  const key = getFailedOrgLogoKey(orgUUID, fileId, version)
  if (!key) {
    return
  }

  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // Ignore storage failures and keep runtime fallback only.
  }
}

export function clearFailedOrgLogo(orgUUID?: string, fileId?: string, version?: string) {
  if (typeof window === 'undefined') {
    return
  }

  const key = getFailedOrgLogoKey(orgUUID, fileId, version)
  if (!key) {
    return
  }

  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Ignore storage failures and keep runtime fallback only.
  }
}
