import { env } from '../config/env.js';
import { getCookieOptions, getFallbackLocalUser, resolveSession } from '../services/authService.js';

function parseCookies(cookieHeader = '') {
	return Object.fromEntries(
		String(cookieHeader || '')
			.split(';')
			.map((item) => item.trim())
			.filter(Boolean)
			.map((item) => {
				const separator = item.indexOf('=');
				if (separator === -1) return [item, ''];
				return [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
			}),
	);
}

export function attachAuthContext(req, res, next) {
	res.locals.authCookieOptions = getCookieOptions();
	req.appMode = env.appMode;

	if (env.appMode === 'local') {
		req.user = getFallbackLocalUser();
		return next();
	}

	const cookies = parseCookies(req.headers.cookie || '');
	const token = cookies[env.authCookieName] || '';
	req.user = resolveSession(token);
	return next();
}

export function requireAppUser(req, res, next) {
	if (req.user) {
		return next();
	}

	return res.status(401).json({ error: 'Authentication required' });
}

export function requireBridgeOrUser(req, res, next) {
	const secret = req.headers['x-bridge-secret'];
	const bridgeSecret = process.env.INTERNAL_BRIDGE_SECRET || 'omnicloud-dev-bridge-secret';
	if (secret && secret === bridgeSecret) {
		req.user = req.user || { id: Number(process.env.BRIDGE_DEFAULT_USER_ID || 1) };
		return next();
	}
	return requireAppUser(req, res, next);
}