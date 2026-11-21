// Builds a single-file solo-only copy of the game (no server needed)
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
const game = fs.readFileSync(__dirname + '/public/world.js', 'utf8');
const out = html.replace('<script src="world.js"></script>', () => '<script>window.DEADLANDS_OFFLINE = true;</script>\n<script>\n' + game + '\n</script>');
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/deadlands-solo.html', out);
console.log('wrote dist/deadlands-solo.html', out.length);
