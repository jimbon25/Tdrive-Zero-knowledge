import { GoogleDriveAdapter } from '../adapters/GoogleDriveAdapter.js';
import { OneDriveAdapter } from '../adapters/OneDriveAdapter.js';
import { DropboxAdapter } from '../adapters/DropboxAdapter.js';
import { MegaAdapter } from '../adapters/MegaAdapter.js';
import { S3Adapter } from '../adapters/S3Adapter.js';
import { PCloudAdapter } from '../adapters/PCloudAdapter.js';
import { YandexAdapter } from '../adapters/YandexAdapter.js';

const adapters = {
	google_drive: GoogleDriveAdapter,
	onedrive: OneDriveAdapter,
	dropbox: DropboxAdapter,
	mega: MegaAdapter,
	s3: S3Adapter,
	pcloud: PCloudAdapter,
	yandex: YandexAdapter,
};

export function createAdapter(account) {
	const Adapter = adapters[account.provider];

	if (!Adapter) {
		throw new Error(`Unsupported provider: ${account.provider}`);
	}

	return new Adapter(account);
}
