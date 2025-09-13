import semver from 'semver';
import { writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import child_process from 'child_process';
import { promisify } from 'util';
import assert from 'assert';

const exec = promisify(child_process.exec);

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

function validateReleaseReadiness(packageJson) {
	const issues = [];

	// Check if we're on a release branch or main
	// This is a soft check - can be overridden with FORCE_RELEASE=true
	const branch = process.env.GIT_BRANCH || 'unknown';
	const isReleaseBranch = /^(main|master|release\/.+)$/.test(branch);

	if (!isReleaseBranch && !process.env.FORCE_RELEASE) {
		issues.push(`Not on a release branch (current: ${branch}). Use FORCE_RELEASE=true to override.`);
	}

	// Check for uncommitted changes
	try {
		child_process.execSync('git diff --quiet && git diff --cached --quiet', { stdio: 'ignore' });
	} catch (error) {
		issues.push('Uncommitted changes detected. Please commit or stash changes before release.');
	}

	return issues;
}

const rootDir = process.cwd();
const packageFile = resolve(rootDir, 'package.json');
const releaseType = process.argv[2] || process.env.RELEASE_TYPE;

// Validate release type
if (releaseType) {
	assert.match(releaseType, /^(patch|minor|major|prerelease|experimental)$/,
		'Invalid RELEASE_TYPE. Must be: patch, minor, major, prerelease, or experimental');
}

try {
	const packageJson = JSON.parse(await readFile(packageFile, 'utf-8'));

	// Validate release readiness
	const issues = validateReleaseReadiness(packageJson);
	if (issues.length > 0 && !process.env.FORCE_RELEASE) {
		console.error('❌ Release preparation failed:');
		issues.forEach(issue => console.error(`  • ${issue}`));
		process.exit(1);
	}

	const currentVersion = packageJson.version;
	const currentInternalVersion = packageJson.internalVersion;

	// Get git info
	const commitHash = await getGitCommitHash();
	const branch = await getGitBranch();
	const timestamp = new Date().toISOString();

	// Determine new version
	let newVersion;
	if (releaseType) {
		// Use provided release type to bump version
		if (releaseType === 'experimental') {
			// Use your existing experimental logic
			const parsed = semver.parse(currentVersion);
			if (parsed.prerelease.length > 0 && parsed.prerelease[0] === 'exp') {
				const expMinor = (parsed.prerelease[1] || 0) + 1;
				newVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}-exp.${expMinor}`;
			} else {
				newVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}-exp.0`;
			}
		} else {
			newVersion = semver.inc(currentVersion, releaseType);
		}
	} else {
		// If internal version exists and is ahead, sync to internal version base
		if (currentInternalVersion) {
			const internalParsed = semver.parse(currentInternalVersion);
			if (internalParsed && semver.gt(`${internalParsed.major}.${internalParsed.minor}.${internalParsed.patch}`, currentVersion)) {
				newVersion = `${internalParsed.major}.${internalParsed.minor}.${internalParsed.patch}`;
				console.log(`📈 Syncing to internal version base: ${newVersion}`);
			} else {
				console.log('ℹ️  No version bump needed - internal and public versions are aligned');
				newVersion = currentVersion;
			}
		} else {
			console.log('ℹ️  No release type specified and no internal version to sync');
			newVersion = currentVersion;
		}
	}

	// Update package.json for release
	const previousVersion = packageJson.version;
	packageJson.version = newVersion;

	// Clean up internal version and build info for release
	if (packageJson.internalVersion) {
		delete packageJson.internalVersion;
	}

	// Update build info for release
	packageJson.buildInfo = {
		version: newVersion,
		commitHash,
		branch,
		buildTimestamp: timestamp,
		buildType: 'release',
		previousVersion,
		...(currentInternalVersion && { previousInternalVersion: currentInternalVersion })
	};

	await writeFile(packageFile, JSON.stringify(packageJson, null, 2) + '\n');

	console.log('🚀 Release prepared successfully!');
	console.log(`📦 Version: ${previousVersion} → ${newVersion}`);
	if (currentInternalVersion) {
		console.log(`🔧 Internal version: ${currentInternalVersion} → [removed]`);
	}
	console.log(`🔗 Commit: ${commitHash} (${branch})`);
	console.log(`⏰ Release time: ${timestamp}`);

	if (issues.length > 0) {
		console.log('\n⚠️  Warnings (overridden by FORCE_RELEASE):');
		issues.forEach(issue => console.log(`  • ${issue}`));
	}

	// Output the new version for use in CI/CD
	console.log(`\n${newVersion}`);

} catch (error) {
	console.error('❌ Failed to prepare release:', error.message);
	process.exit(1);
}
