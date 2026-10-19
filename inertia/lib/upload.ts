/**
 * PUT a file straight to a presigned storage URL. XHR rather than `fetch`
 * because only XHR reports upload progress. File bytes never touch Share.
 */
export function putWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(file.size, file.size)
        resolve()
      } else {
        reject(new Error(`Storage rejected the upload (HTTP ${xhr.status})`))
      }
    }
    // A CORS rejection from the bucket also lands here, with no status to show.
    xhr.onerror = () => reject(new Error('Network error while uploading'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    xhr.send(file)
  })
}
