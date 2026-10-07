import type { IOperationResult } from '@microsoft/power-apps/data'
import type { _5RNewAppsRead, _5RNewAppsWrite } from './generated/models/_5RNewAppsModel'
import {
  createAttachmentOperationName,
  postItemOperationName as createItemOperationName,
  powerAppsClient as attachmentClient,
  primaryDataSourceName as dataSourceName,
  sharePointSiteUrl,
} from './powerAppsClient'

const sharePointListId = '00000000-0000-4000-8000-000000000014'
const sharePointListName = '5R New Apps'
const sharePoint5RItemListId = '00000000-0000-4000-8000-000000000002'
const sharePoint5RItemListName = '5R_ITEM'

type SharePointAttachment = {
  Id?: string
  AbsoluteUri?: string
  DisplayName?: string
}

type UploadAttachmentOptions = {
  itemId: number | string
  fileName: string
  file?: Blob
  fileBuffer?: ArrayBuffer | Uint8Array
}

type Create5RItemTestPayload = {
  ID5R: string
}

type SharePointCreatedItem = {
  ID?: number
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

async function toBase64(data: Blob | ArrayBuffer | Uint8Array) {
  if (data instanceof Blob) {
    return bytesToBase64(new Uint8Array(await data.arrayBuffer()))
  }

  if (data instanceof Uint8Array) {
    return bytesToBase64(data)
  }

  return bytesToBase64(new Uint8Array(data))
}

function getPowerAppsOperationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return JSON.stringify(error)
}

function isNotFoundOperationResult(result: IOperationResult<unknown>) {
  const error = result.error

  if (!error) {
    return false
  }

  if (typeof error === 'object') {
    const record = error as unknown as Record<string, unknown>

    if (record.status === 404 || record.status === '404') {
      return true
    }

    if (typeof record.message === 'string' && record.message.includes('"statusCode":404')) {
      return true
    }
  }

  return error instanceof Error && error.message.includes('"statusCode":404')
}

async function createSharePointListItem(
  item: Omit<_5RNewAppsWrite, 'ID'>,
): Promise<IOperationResult<_5RNewAppsRead>> {
  return attachmentClient.executeAsync<
    {
      dataset: string
      table: string
      item: Omit<_5RNewAppsWrite, 'ID'>
    },
    _5RNewAppsRead
  >({
    connectorOperation: {
      tableName: dataSourceName,
      operationName: createItemOperationName,
      parameters: {
        dataset: sharePointSiteUrl,
        table: sharePointListId,
        item,
      },
    },
  })
}

async function create5RItemTestListItem(
  item: Create5RItemTestPayload,
): Promise<IOperationResult<SharePointCreatedItem>> {
  return attachmentClient.executeAsync<
    {
      dataset: string
      table: string
      item: Create5RItemTestPayload
    },
    SharePointCreatedItem
  >({
    connectorOperation: {
      tableName: dataSourceName,
      operationName: createItemOperationName,
      parameters: {
        dataset: sharePointSiteUrl,
        table: sharePoint5RItemListName,
        item,
      },
    },
  })
}

async function uploadAttachmentToListItem(
  table: string,
  { itemId, fileName, file, fileBuffer }: UploadAttachmentOptions,
): Promise<IOperationResult<SharePointAttachment>> {
  const fileContent = file ?? fileBuffer

  if (!fileContent) {
    throw new Error(`File content untuk "${fileName}" kosong.`)
  }

  return attachmentClient.executeAsync<
    {
      dataset: string
      table: string
      itemId: number
      displayName: string
      body: string
    },
    SharePointAttachment
  >({
    connectorOperation: {
      tableName: dataSourceName,
      operationName: createAttachmentOperationName,
      parameters: {
        dataset: sharePointSiteUrl,
        table,
        itemId: Number(itemId),
        displayName: fileName,
        body: await toBase64(fileContent),
      },
    },
  })
}

async function uploadAttachmentToSharePoint({
  itemId,
  fileName,
  file,
  fileBuffer,
}: UploadAttachmentOptions): Promise<IOperationResult<SharePointAttachment>> {
  const fileContent = file ?? fileBuffer

  if (!fileContent) {
    throw new Error(`File content untuk "${fileName}" kosong.`)
  }

  const result = await uploadAttachmentToListItem(sharePointListId, {
    itemId,
    fileName,
    file,
    fileBuffer,
  })

  if (!result.success && isNotFoundOperationResult(result)) {
    const fallbackResult = await uploadAttachmentToListItem(sharePointListName, {
      itemId,
      fileName,
      file,
      fileBuffer,
    })

    if (fallbackResult.success) {
      return fallbackResult
    }
  }

  if (!result.success) {
    throw new Error(`Upload "${fileName}" gagal: ${getPowerAppsOperationErrorMessage(result.error)}`)
  }

  return result
}

async function upload5RItemTestAttachment(
  options: UploadAttachmentOptions,
): Promise<IOperationResult<SharePointAttachment>> {
  const result = await uploadAttachmentToListItem(sharePoint5RItemListId, options)

  if (!result.success && isNotFoundOperationResult(result)) {
    const fallbackResult = await uploadAttachmentToListItem(sharePoint5RItemListName, options)

    if (fallbackResult.success) {
      return fallbackResult
    }
  }

  if (!result.success) {
    throw new Error(`Upload "${options.fileName}" gagal: ${getPowerAppsOperationErrorMessage(result.error)}`)
  }

  return result
}

export {
  create5RItemTestListItem,
  createSharePointListItem,
  toBase64,
  upload5RItemTestAttachment,
  uploadAttachmentToSharePoint,
}
