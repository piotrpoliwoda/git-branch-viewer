const fs = require('fs');
const { execSync } = require('child_process');

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = packageJson.version.split('.');
version[2] = parseInt(version[2]) + 1;
packageJson.version = version.join('.');
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));
// run commit command
execSync('git add package.json');
execSync(`git commit -m "chore: upgrade patch version to ${packageJson.version}"`);
