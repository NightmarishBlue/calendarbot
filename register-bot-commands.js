// no longer necessary - bot automatically registers and refreshes its commands on startup
const { REST, Routes } = require("discord.js");
require('dotenv').config();

const meEndpoint = "https://discordapp.com/api/oauth2/applications/@me"; // endpoint used to get bot's own info

let appId = process.env.APPLICATION_ID;
let guildId = process.env.GUILD_ID;

const commandJSONArray = require('./bot-commands.json')
if (!(process.env.BOT_TOKEN)) {
    console.error("Error: $BOT_TOKEN is unset");
    return 1;
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bot ' + process.env.BOT_TOKEN
}

const mode = (process.argv.includes('-g')) && 'guild' || 'app';
// display some messages that a user might find helpful
if (process.stdout.isTTY) {
    if (process.argv.length < 3) console.error('No commandline arguments specified, defaulting to application.\nUse -a to specify application, and -g to specify guild.');
    (mode == 'guild') && console.log(`Registering commands to guild`) || console.log(`Registering application commands, remember that Discord rate limits this`);
}

const rest = new REST().setToken(process.env.BOT_TOKEN)

async function main() {
// get the bot's app ID
    res = await fetch(meEndpoint, {headers: headers});
    if (res.ok) {
        let data = await res.json();
        if (data.id) appId = data.id;
    }
    else return 1;

    if (!appId) {
        console.error(`have no app ID `)
        return 1;
    }

    let ret = 0;
    async function register() {
        const route = (mode === "app") ? Routes.applicationCommands(appId) : Routes.applicationGuildCommands(appId, guildId)
        try {
            await rest.put(
                Routes.applicationCommands(appId),
                { body: commandJSONArray },
            );
            console.log(`Successfully registered ${commandJSONArray.length} commands`);
        } catch (error) {
            console.error(error);
            ret = 1;
        }
    }
    await register();
    return ret;
}
let ret = 0;
main().then(res => ret = res).catch()
return ret;
// God I love JavaScript
// Also sometimes this doesn't even stop Discord's API from erroring with Too Many Requests. Life is good.
