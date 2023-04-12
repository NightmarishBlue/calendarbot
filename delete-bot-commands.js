require('dotenv').config();
const { readFileSync } = require('fs');
const { exit } = require('process');

const guildRegisterURL = 'https://discord.com/api/v10/applications/' + process.env.APPLICATION_ID + '/guilds/' + process.env.GUILD_ID + '/commands'
const appRegisterURL = 'https://discord.com/api/v10/applications/' + process.env.APPLICATION_ID + '/commands'
const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bot ' + process.env.BOT_TOKEN
}

console.log('Make sure command-ids.txt is present in the current directory before you try running this.')
const mode = (process.argv.includes('-g')) && 'guild' || 'app';
if (process.argv.length < 3) console.error('No commandline arguments specified, defaulting to application.\nUse -a to specify application, and -g to specify guild.');
(mode == 'guild') && console.log(`Registering commands to guild`) || console.log(`Registering application commands, remember that Discord rate limits this`);

const URL = (mode == 'app') ? appRegisterURL : guildRegisterURL;
const commandIDs = readFileSync('./command-ids.txt', 'utf-8').split(/\s+/)
if (commandIDs[0] === '') {
    console.log('It looks like there\'s no commands to delete in command-ids.txt, terminating')
    exit(1);
}

const time = ms => new Promise(res => setTimeout(res, ms))

function deleteCommand(commandID) {
    fetch(`${URL}\\${commandID}`, {
        method: 'DELETE',
        headers: headers
    }).then(
        res => {
            if (res.ok) {
                console.log(`Successfully deleted ${commandID}, response ${res.status} (${res.statusText})`)
            } else {
                console.log(`Failed to delete ${commandID}, response ${res.status} (${res.statusText})`)
            };
        }
    ).catch(
        err => {
            console.error(`Failed to make request for ${commandID} (${err})`)
        }
    )
}

async function main() {
    for (let i = 0; i < commandIDs.length; i++){
        deleteCommand(commandJSONArray[i])
        await time(2000)
    }
}
main()