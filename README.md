# calendarbot
![relevant tech](https://skillicons.dev/icons?i=js,nodejs)

A Discord bot for the [mytimetable](https://mytimetable.dcu.ie/) system. 
# Get started
CalendarBot automatically registers its commands, so all you have to do is get it running.
## Docker
CalendarBot has a GitHub container package that can be pulled and ran on AMD and ARM 64. I recommend using `docker-compose`, something like this should do nice:
```yml
calendarbot:
    image: ghcr.io/nightmarishblue/calendarbot
    environment:
        BOT_TOKEN: "******"
```
## Manual
If you're developing, the bot depends on `dotenv` for ease of work.
Fill in `.env` with the `BOT_TOKEN` environment variable. You can add `GUILD_ID`, in which case the bot will automatically scope itself to the given guild (useful since Discord rate limits it less).

# Using commands
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


There are `/updatechannel` and `/channelinfo`, which work the exact same as the above, but will send to a server channel instead. You need the Manage Channels permission for it to work. The info is stored in `user-data.json`, in the same directory as the main JSON files.
