const { isOp, getChannel } = require("./../api");
const { getUpdateURL } = require("./../config")
const fs = require("fs");
const path = require("path");
const https = require("https");
const unzipper = require("unzipper");
const { execSync } = require("child_process");

const blacklist = [
    "config.json",
    "openai_token.txt",
    "token.txt"
]

const TEMP_DIR = path.join(process.cwd, "update_temp");

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage} ${JSON.stringify(response.headers)}`));
      }
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

function checkAndUpdateDependencies(channel) {

    console.log("Updating dependencies...");
    channel.send("Updating dependencies...");
    try {
      execSync("npm install --production", { stdio: "inherit" });
      console.log("✅ Dependencies updated.");
      channel.send("✅ Dependencies updated.")
    } catch (err) {
      console.error("❌ Failed to install dependencies:", err);
      channel.send("❌ Failed to install dependencies: " + err);
    }

}

function copyFiles(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  fs.readdirSync(src).forEach((file) => {
    if (blacklist.includes(file)) return;

    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(srcPath).isDirectory()) {
        fs.rmSync(srcPath, {force: true}); //Remove the directory to remove child files
        fs.mkdirSync(srcPath);
      copyFiles(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

/**
 * This is a basic template for how commands should be setup.
 *
 * @field name The string of characters used to call this command. Do not add
 * the prefix to the start, or if you must, use {prefix}
 * @field usage How this command should be used. Provided in the help command.
 * @field description The description for this command
 * @function canUse Whether the sender can use this command or not. Must return
 * true if run() is ever to be called
 * @function run The code executed when this command is run
 */
module.exports = {
    name: "update",
    usage: "update [-d]",
    description: "Updates the bot",
    canUse: function(sender) {
        return isOp(sender.id);
    },
    run: async function(messageObj, channel, sender, args) {
        try {
            if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            fs.mkdirSync(TEMP_DIR);

            const zipPath = path.join(TEMP_DIR, "update.zip");
            console.log("Downloading update...");
            channel.send("Downloading update...");
            var failed = false;
            await downloadFile(getUpdateURL(), zipPath).then(() => {
                console.log("✅ Download successful.");
                channel.send("✅ Download successful.");
            }, (reject) => {
                console.error("❌ Download failed!", reject);
                channel.send("❌ Download failed! " + reject);
                failed = true;
            });
            if (failed) return;

            console.log("Extracting zip file...");
            channel.send("Extracting zip file...")
            await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: TEMP_DIR })).promise();

            const extractedFolder = fs.readdirSync(TEMP_DIR).find(f => fs.statSync(path.join(TEMP_DIR, f)).isDirectory());
            const extractedPath = path.join(TEMP_DIR, extractedFolder);

            console.log("Replacing files...");
            channel.send("Replacing files...");
            copyFiles(extractedPath, process.cwd);

            if (args.indexOf("-d") !== -1) {
                checkAndUpdateDependencies(channel);
            }

            console.log("Cleaning up...");
            channel.send("Cleaning up...");
            fs.rmSync(TEMP_DIR, { recursive: true, force: true });

            console.log("✅ Update complete! Restarting bot...");
            channel.send("✅ Update complete! Restarting bot...");
            process.exit(0);
        } catch (error) {
            console.error("❌ Update failed:", error);
            channel.send("❌ Update failed: " + error);
        }
        
    }
}
