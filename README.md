# calendarbot
A Discord bot for the [opentimetable](https://opentimetable.dcu.ie/) system. 
## Get started
Fill in `.env` with the variables `BOT_TOKEN`, `APPLICATION_ID` and `GUILD_ID` (optionally, if you want to register guild commands). Then run `register-bot-commands.js`.

## Managing commands
Run `register-bot-commands.js` and it will register everything in `bot-commands.json` (which is filled out with all the commands already). `delete-bot-commands.js` takes every command ID in `command-ids.txt` (separated by whitespace) and unregisters them.
Both programs default to global application commands, which is what you probably want unless you're debugging. Specify `-g` as a commandline argument to switch to registering to (or deleting from) a specific server.

Also, fetch was added to NodeJS in v17.5, so don't use any super old Node installs.
## Using commands
* `/timetable` `[course codes]` `<day of week>`
Get the timetable for the given course for a day of this week. Defaults to today.


* `/checkrooms` `[room codes]` `<times>`
Query a room code or set of room codes for events during the time period in times, all separated by whitespace. 
Times only support hours between 0 and 23, so `/timetable` `L101` `8 12` will check L101 between 8:00 and 12:00. The start time defaults to the current hour, and the end time defaults to an hour after start time.


* `/labfree` `<times>`
Checks all the labs in the McNulty building for the given times. Works the same as above.

## Daily updates
* `/updateme` `<course>` `<nextday>` `<ignoretutorials>` `<autoupdate>`
Register yourself in the bot's database to receive your timetable daily by direct message.
You can receive it the morning of, or the night before, filter out tutorial slots, and automatically update the course code when you move up a year.
If you call it and leave `course` blank, you will be removed from the database.


* `/myinfo`
Gives you your daily update settings.


There are `/updatechannel` and `/channelinfo`, which work the exact same as the above, but will send to a server channel instead. You need the Manage Channels permission (I think) for it to work. The info is stored in `user-data.json`, in the same directory as the main JSON files.