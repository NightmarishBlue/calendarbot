require('dotenv').config();

const guildRegisterURL = 'https://discord.com/api/v10/applications/' + process.env.APPLICATION_ID + '/guilds/' + process.env.GUILD_ID + '/commands'
const appRegisterURL = 'https://discord.com/api/v10/applications/' + process.env.APPLICATION_ID + '/commands'
const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bot ' + process.env.BOT_TOKEN
}

const mode = (process.argv.includes('-g')) && 'guild' || 'app';
if (process.argv.length < 3) console.error('No commandline arguments specified, defaulting to application.\nUse -a to specify application, and -g to specify guild.');
(mode == 'guild') && console.log(`Registering commands to guild`) || console.log(`Registering application commands, remember that Discord rate limits this`);

const URL = (mode == 'app') ? appRegisterURL : guildRegisterURL;
const commandJSONArray = require('./bot-commands.json')

const time = ms => new Promise(res => setTimeout(res, ms))

function registerCommand(command) {
    fetch(URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(command)
    }).then(
        res => {
            if (res.ok) {
                console.log(`Successfully registered ${command.name}, response ${res.status} (${res.statusText})`)
            } else {
                console.log(`Failed to register ${command.name}, response ${res.status} (${res.statusText})\n${res.text}`)
            };
        }
    ).catch(
        err => {
            console.error(`Failed to make request for ${command.name} (${err})`)
        }
    )
}

async function main() {
    for (let i = 0; i < commandJSONArray.length; i++){
        registerCommand(commandJSONArray[i])
        await time(1000)
    }
}
main()
// God I love JavaScript
// Also sometimes this doesn't even stop Discord's API from erroring with Too Many Requests. Life is good.