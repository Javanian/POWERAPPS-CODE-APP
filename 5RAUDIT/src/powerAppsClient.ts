import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../.power/schemas/appschemas/dataSourcesInfo'

export const primaryDataSourceName = '5r new apps'
export const sharePointSiteUrl = 'https://example.sharepoint.com/sites/operations/corporate/QHSE'

export const postItemOperationName = 'PostItem'
export const createAttachmentOperationName = 'CreateAttachment'
export const getItemsOperationName = 'GetItems'
export const httpRequestOperationName = 'HttpRequest'
export const createFileOperationName = 'CreateFile'

// The SDK caches the first descriptor. Register manual operations together
// and use this client so later calls can resolve their operation paths.
const extendedDataSourcesInfo = {
  ...dataSourcesInfo,
  [primaryDataSourceName]: {
    ...dataSourcesInfo[primaryDataSourceName],
    apis: {
      ...dataSourcesInfo[primaryDataSourceName].apis,
      [postItemOperationName]: {
        path: '/{connectionId}/datasets/{dataset}/tables/{table}/items',
        method: 'POST',
        parameters: [
          { name: 'connectionId', in: 'path', required: true, type: 'string' },
          { name: 'dataset', in: 'path', required: true, type: 'string' },
          { name: 'table', in: 'path', required: true, type: 'string' },
          { name: 'item', in: 'body', required: true, type: 'object' },
        ],
        responseInfo: {
          '200': { type: 'object' },
          '201': { type: 'object' },
        },
      },
      [createAttachmentOperationName]: {
        path: '/{connectionId}/datasets/{dataset}/tables/{table}/items/{itemId}/attachments',
        method: 'POST',
        parameters: [
          { name: 'connectionId', in: 'path', required: true, type: 'string' },
          { name: 'dataset', in: 'path', required: true, type: 'string' },
          { name: 'table', in: 'path', required: true, type: 'string' },
          { name: 'itemId', in: 'path', required: true, type: 'integer' },
          { name: 'displayName', in: 'query', required: true, type: 'string' },
          { name: 'body', in: 'body', required: true, type: 'string', format: 'binary' },
        ],
        responseInfo: {
          '200': { type: 'object' },
          '201': { type: 'object' },
        },
      },
      [getItemsOperationName]: {
        path: '/{connectionId}/datasets/{dataset}/tables/{table}/items',
        method: 'GET',
        parameters: [
          { name: 'connectionId', in: 'path', required: true, type: 'string' },
          { name: 'dataset', in: 'path', required: true, type: 'string' },
          { name: 'table', in: 'path', required: true, type: 'string' },
          { name: '$top', in: 'query', required: true, type: 'integer' },
        ],
        responseInfo: {
          '200': { type: 'object' },
        },
      },
      // Action resmi connector "Create file" — upload file binary ke document
      // library (SiteAssets) untuk sumber kolom image; file di folder
      // Attachments TIDAK bisa dirender thumbnail oleh kolom image.
      [createFileOperationName]: {
        path: '/{connectionId}/datasets/{dataset}/files',
        method: 'POST',
        parameters: [
          { name: 'connectionId', in: 'path', required: true, type: 'string' },
          { name: 'dataset', in: 'path', required: true, type: 'string' },
          { name: 'folderPath', in: 'query', required: true, type: 'string' },
          { name: 'name', in: 'query', required: true, type: 'string' },
          { name: 'overwrite', in: 'query', required: false, type: 'boolean' },
          { name: 'body', in: 'body', required: true, type: 'string', format: 'binary' },
        ],
        responseInfo: {
          '200': { type: 'object' },
          '201': { type: 'object' },
        },
      },
      // Action resmi connector "Send an HTTP request to SharePoint" — REST
      // di-proxy connector (auth ditangani runtime). Dipakai untuk hal yang
      // tidak diekspos schema item, mis. kolom image (Thumbnail).
      [httpRequestOperationName]: {
        path: '/{connectionId}/datasets/{dataset}/httprequest',
        method: 'POST',
        parameters: [
          { name: 'connectionId', in: 'path', required: true, type: 'string' },
          { name: 'dataset', in: 'path', required: true, type: 'string' },
          { name: 'request', in: 'body', required: true, type: 'object' },
        ],
        responseInfo: {
          '200': { type: 'object' },
          '201': { type: 'object' },
          '204': { type: 'object' },
        },
      },
    },
  },
}

export const powerAppsClient = getClient(extendedDataSourcesInfo)
