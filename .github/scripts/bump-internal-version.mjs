import semver from 'semver';
import { writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

function generateInternalVersion(currentVersion, currentInternalVersion) {
	const parsed = semver.parse(currentVersion);
	if (!parsed) throw new Error(`Invalid version: ${currentVersion}`);

	// If we have an existing internal version, increment it
	if (currentInternalVersion) {
		const internalParsed = semver.parse(currentInternalVersion);
		if (internalParsed &&
			internalParsed.major === parsed.major &&
			internalParsed.minor === parsed.minor &&
			internalParsed.patch === parsed.patch &&
			internalParsed.prerelease.length > 0 &&
			internalParsed.prerelease[0] === 'internal') {
			// Increment the internal build number
			const buildNumber = (internalParsed.prerelease[1] || 0) + 1;
			return `${parsed.major}.${parsed.minor}.${parsed.patch}-internal.${buildNumber}`;
		}
	}

	// Create new internal version: <major>.<minor>.<patch>-internal.1
	return `${parsed.major}.${parsed.minor}.${parsed.patch}-internal.1`;
}

async function getGitCommitHash() {
	try {
		const { stdout } = await exec('git rev-parse --short HEAD');
		return stdout.trim();
	} catch (error) {
		console.warn('Could not get git commit hash:', error.message);
		return 'unknown';
	}
}

async function getGitBranch() {
	try {
		const { stdout } = await exec('git rev-parse --abbrev-ref HEAD');
		return stdout.trim();
	} catch (error) {
		console.warn('Could not get git branch:', error.message);
		return 'unknown';
	}
}

const rootDir = process.cwd();
const packageFile = resolve(rootDir, 'package.json');

try {
	const packageJson = JSON.parse(await readFile(packageFile, 'utf-8'));
	const currentVersion = packageJson.version;
	const currentInternalVersion = packageJson.internalVersion;

	// Generate new internal version
	const newInternalVersion = generateInternalVersion(currentVersion, currentInternalVersion);

	// Get git info for metadata
	const commitHash = await getGitCommitHash();
	const branch = await getGitBranch();
	const timestamp = new Date().toISOString();

	// Update package.json
	packageJson.internalVersion = newInternalVersion;

	// Add build metadata (optional)
	if (!packageJson.buildInfo) {
		packageJson.buildInfo = {};
	}

	packageJson.buildInfo = {
		...packageJson.buildInfo,
		internalVersion: newInternalVersion,
		commitHash,
		branch,
		buildTimestamp: timestamp,
		buildType: 'internal'
	};

	await writeFile(packageFile, JSON.stringify(packageJson, null, 2) + '\n');

	console.log(`✅ Internal version bumped: ${currentInternalVersion || 'none'} → ${newInternalVersion}`);
	console.log(`📦 Public version remains: ${currentVersion}`);
	console.log(`🔗 Commit: ${commitHash} (${branch})`);
	console.log(`⏰ Build time: ${timestamp}`);

} catch (error) {
	console.error('❌ Failed to bump internal version:', error.message);
	process.exit(1);
}
