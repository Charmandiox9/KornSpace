export const FOLDER_CONTENTS_QUERY = `query FolderContents($parentId: ID) {
  folderContents(parentId: $parentId) {
    folder { id name description storageBytes ownerId parentId createdAt updatedAt permission }
    breadcrumbs { id name description ownerId parentId createdAt updatedAt permission }
    folders { id name description storageBytes ownerId parentId createdAt updatedAt permission }
    files { id name description contentType sizeBytes status checksum createdAt updatedAt deletedAt ownerId ownerName folderId folderName openedAt permission }
  }
}`;

export const FILE_LIBRARY_QUERY = `query FileLibrary($shared: Boolean!) {
  all: fileLibrary(filters: { shared: $shared }) {
    id name description contentType sizeBytes status checksum createdAt updatedAt deletedAt
    ownerId ownerName folderId folderName permission openedAt
  }
  folderContents(includeFiles: false) {
    folders { id name description storageBytes ownerId parentId createdAt updatedAt permission }
  }
}`;

export const STORAGE_USAGE_QUERY = `query StorageUsage {
  storageUsage {
    totalBytes trashBytes
    files {
      id name description contentType sizeBytes status checksum createdAt updatedAt deletedAt
      ownerId ownerName folderId folderName permission openedAt
    }
  }
}`;
