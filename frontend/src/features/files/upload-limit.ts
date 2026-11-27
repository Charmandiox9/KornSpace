import { maxUploadBytes } from './upload-queue';

const configuredMaxBytes = Number(process.env.NEXT_PUBLIC_FILE_MAX_SIZE_BYTES);

export const uploadSizeLimit = Number.isSafeInteger(configuredMaxBytes) && configuredMaxBytes > 0
  ? Math.min(configuredMaxBytes, maxUploadBytes)
  : maxUploadBytes;

export const uploadLimitLabel = uploadSizeLimit === maxUploadBytes ? '1 GiB' : `${uploadSizeLimit / 1_000_000} MB`;
