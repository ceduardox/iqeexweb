import { getBackendUrl, getConfig } from '@services/config/config'

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

function buildContentUrl(relativePath: string) {
  const normalizedPath = relativePath.replace(/^\/+/, '')
  const mediaUrl = getConfig('NEXT_PUBLIC_LEARNHOUSE_MEDIA_URL')
  if (mediaUrl) {
    return `${normalizeBaseUrl(mediaUrl)}/${normalizedPath}`
  }

  const backendUrl = getBackendUrl()
  if (backendUrl) {
    try {
      const parsedBackendUrl = new URL(backendUrl)
      const isLocalBackend =
        parsedBackendUrl.hostname === 'localhost' || parsedBackendUrl.hostname === '127.0.0.1'

      if (isLocalBackend) {
        return `/${normalizedPath}`
      }

      if (
        typeof window !== 'undefined' &&
        parsedBackendUrl.origin === window.location.origin
      ) {
        return `/${normalizedPath}`
      }

      return `${normalizeBaseUrl(backendUrl)}/${normalizedPath}`
    } catch {
      return `/${normalizedPath}`
    }
  }

  return `/${normalizedPath}`
}

function getStoredMediaUrl(fileId: string) {
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) {
    return fileId
  }

  if (fileId.startsWith('/content/') || fileId.startsWith('content/')) {
    return buildContentUrl(fileId)
  }

  return null
}

function normalizeCourseThumbnailFileId(fileId: string) {
  if (!fileId) {
    return fileId
  }

  const normalizedFileId = fileId.split('?')[0].split('#')[0]

  let contentPath = ''
  if (normalizedFileId.startsWith('/content/')) {
    contentPath = normalizedFileId.replace(/^\/+/, '')
  } else if (normalizedFileId.startsWith('content/')) {
    contentPath = normalizedFileId
  } else if (
    normalizedFileId.startsWith('http://') ||
    normalizedFileId.startsWith('https://')
  ) {
    try {
      contentPath = new URL(normalizedFileId).pathname.replace(/^\/+/, '')
    } catch {
      return fileId
    }
  }

  if (!contentPath) {
    return fileId
  }

  const isOrgThumbnailPath = /^content\/orgs\/[^/]+\/thumbnails\/[^/]+$/i.test(
    contentPath
  )
  const isCourseThumbnailPath =
    /^content\/orgs\/[^/]+\/courses\/[^/]+\/thumbnails\/[^/]+$/i.test(contentPath)

  if (isOrgThumbnailPath && !isCourseThumbnailPath) {
    const segments = contentPath.split('/').filter(Boolean)
    return segments[segments.length - 1] || fileId
  }

  return fileId
}

function getApiUrl() {
  return getBackendUrl();
}

/**
 * Get the streaming URL for an activity video.
 * Uses the optimized streaming endpoint with proper Range request support.
 */
export function getActivityVideoStreamUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  filename: string
) {
  return `${getApiUrl()}api/v1/stream/video/${orgUUID}/${courseUUID}/${activityUUID}/${filename}`
}

/**
 * Get the streaming URL for a video block.
 * Uses the optimized streaming endpoint with proper Range request support.
 */
export function getVideoBlockStreamUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  blockUUID: string,
  filename: string
) {
  return `${getApiUrl()}api/v1/stream/block/${orgUUID}/${courseUUID}/${activityUUID}/${blockUUID}/${filename}`
}

/**
 * Get the streaming URL for an audio block.
 * Uses the optimized streaming endpoint with proper Range request support.
 */
export function getAudioBlockStreamUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  blockUUID: string,
  filename: string
) {
  return `${getApiUrl()}api/v1/stream/block/audio/${orgUUID}/${courseUUID}/${activityUUID}/${blockUUID}/${filename}`
}

export function getCourseThumbnailMediaDirectory(
  orgUUID: string,
  courseUUID: string,
  fileId: string
) {
  const normalizedFileId = normalizeCourseThumbnailFileId(fileId)
  const storedMediaUrl = getStoredMediaUrl(normalizedFileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(
    `content/orgs/${orgUUID}/courses/${courseUUID}/thumbnails/${normalizedFileId}`
  )
}

export function getBoardThumbnailMediaDirectory(
  orgUUID: string,
  boardUUID: string,
  fileId: string
) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/boards/${boardUUID}/thumbnails/${fileId}`)
}

export function getPlaygroundThumbnailMediaDirectory(
  orgUUID: string,
  playgroundUUID: string,
  fileId: string
) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/playgrounds/${playgroundUUID}/thumbnails/${fileId}`)
}

export function getCommunityThumbnailMediaDirectory(
  orgUUID: string,
  communityUUID: string,
  fileId: string
) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/communities/${communityUUID}/thumbnails/${fileId}`)
}

export function getOrgLandingMediaDirectory(orgUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/landing/${fileId}`)
}

export function getUserAvatarMediaDirectory(userUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/users/${userUUID}/avatars/${fileId}`)
}

export function getActivityBlockMediaDirectory(
  orgUUID: string,
  courseId: string,
  activityId: string,
  blockId: any,
  fileId: any,
  type: string
) {
  if (type == 'pdfBlock') {
    return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/pdfBlock/${blockId}/${fileId}`)
  }
  if (type == 'videoBlock') {
    return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/videoBlock/${blockId}/${fileId}`)
  }
  if (type == 'imageBlock') {
    return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/imageBlock/${blockId}/${fileId}`)
  }
  if (type == 'audioBlock') {
    return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/audioBlock/${blockId}/${fileId}`)
  }
}

export function getTaskRefFileDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileID : string

) {
  return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/${fileID}`)
}

export function getTaskFileSubmissionDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileSubID : string
) {
  return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/subs/${fileSubID}`)
}

export function getActivityMediaDirectory(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  fileId: string,
  activityType: string
) {
  if (activityType == 'video') {
    return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/video/${fileId}`)
  }
  if (activityType == 'documentpdf') {
    return buildContentUrl(`content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/documentpdf/${fileId}`)
  }
}

export function getOrgLogoMediaDirectory(orgUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/logos/${fileId}`)
}

export function getOrgThumbnailMediaDirectory(orgUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/thumbnails/${fileId}`)
}

export function getOrgPreviewMediaDirectory(orgUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/previews/${fileId}`)
}

export function getOrgOgImageMediaDirectory(orgUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/og_images/${fileId}`)
}

export function getOrgAuthBackgroundMediaDirectory(orgUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/auth_backgrounds/${fileId}`)
}

export function getOrgFaviconMediaDirectory(orgUUID: string, fileId: string) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/favicons/${fileId}`)
}

/**
 * Get the URL for SCORM content files
 * Routes through a local proxy to ensure same-origin for SCORM API injection
 */
export function getScormContentUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  filePath: string
): string {
  // Use local proxy route to serve SCORM content from same origin
  // This is required for the SCORM API to work properly in iframes
  return `/api/scorm/${activityUUID}/content/${filePath}`
}

/**
 * Get the thumbnail URL for a podcast
 */
export function getPodcastThumbnailMediaDirectory(
  orgUUID: string,
  podcastUUID: string,
  fileId: string
) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/podcasts/${podcastUUID}/thumbnails/${fileId}`)
}

/**
 * Get the thumbnail URL for a podcast episode
 */
export function getEpisodeThumbnailMediaDirectory(
  orgUUID: string,
  podcastUUID: string,
  episodeUUID: string,
  fileId: string
) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/podcasts/${podcastUUID}/episodes/${episodeUUID}/thumbnails/${fileId}`)
}

/**
 * Get the direct media URL for a podcast episode audio file.
 */
export function getEpisodeAudioMediaDirectory(
  orgUUID: string,
  podcastUUID: string,
  episodeUUID: string,
  fileId: string
) {
  const storedMediaUrl = getStoredMediaUrl(fileId)
  if (storedMediaUrl) return storedMediaUrl
  return buildContentUrl(`content/orgs/${orgUUID}/podcasts/${podcastUUID}/episodes/${episodeUUID}/audio/${fileId}`)
}

/**
 * Get the streaming URL for a podcast episode audio file.
 * Uses the optimized streaming endpoint with proper Range request support.
 */
export function getPodcastAudioStreamUrl(
  orgUUID: string,
  podcastUUID: string,
  episodeUUID: string,
  filename: string
) {
  return `${getApiUrl()}api/v1/stream/audio/${orgUUID}/${podcastUUID}/${episodeUUID}/${filename}`
}
