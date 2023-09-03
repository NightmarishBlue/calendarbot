const Discord = require('discord.js')
const DiscordFunctions = require('./discord-functions.js')
const Timetable = require('./timetable.js')

// Grabs the room IDs of a list of codes, using a JSON file.
// It might be better to query them all instead.
function findRoomIdentities(codesToQuery) {
  let rooms = {};
  let invalidRooms = [];
  let roomIDs = require('./gla-room-ids.json');

  codesToQuery.forEach(inputCode => {
    let roomID = roomIDs[inputCode]
    if (roomID != undefined) {
      rooms[inputCode] = roomID
    } else {
      invalidRooms.push(inputCode)
    };
  });
  return [rooms, invalidRooms]
};

// Ensuring the times are correct is a depressingly difficult task.
// This function does that, adding errors to an embed.
function generateTimeRange(errorEmbed, timeRange) {
  let date = new Date();
  const currentTime = date.getHours();
  const defaultTimes = [currentTime, (currentTime + 1) % 24]
  try {
    timeRange = timeRange.split(/\s/);
  } catch {
    timeRange = defaultTimes;
  }

  let [startHour, endHour] = timeRange
  if (!(startHour in Discord.range(0, 23))) {
    if (startHour != undefined) errorEmbed.addErrorField('Given start hour was invalid.', 'Using current hour.');
    startHour = defaultTimes[0]
  }
  if (!(endHour in Discord.range(0, 23))) {
    if (endHour != undefined) errorEmbed.addErrorField('Given end hour was invalid.', 'Set to an hour ahead of start time.');
    endHour = (parseInt(startHour) + 1) % 24;
  }
  date.setHours(startHour)
  const startDate = date.toISOString()
  date.setHours(endHour)
  const endDate = date.toISOString()
  return [errorEmbed, [Timetable.timeToString(startHour), Timetable.timeToString(endHour)], [startDate, endDate]]
}


// Checks a set of rooms for a one hour period
// Returns that as a list of embeds.
async function checkRoom(errorEmbed, roomCodes, timeRange, timeObjects) {
  // roomCodes must be a list of strings
  // timeRange is a list of two times, start and end, formatted to 'X:XX'.
  // They should be checked before this function is called.
  const [startTime, endTime] = timeRange
  const [startDate, endDate] = timeObjects

  const inputCodes = findRoomIdentities(roomCodes);
  const validRooms = Object.values(inputCodes[0]);
  const invalidRooms = inputCodes[1];

  if (validRooms.length == 0) {
    errorEmbed = errorEmbed.addErrorField('None of the given rooms were found in the GLA database', `${invalidRooms.join(', ')}`);
    return [errorEmbed]
  }
  if (invalidRooms.length > 0) {
    errorEmbed = errorEmbed.addErrorField(`These rooms were not found in the GLA database`, `${invalidRooms.join(', ')}`);
  }

  let outputEmbed = new Discord.EmbedBuilder()
    .setColor('Green')
    .setTitle(`Checking rooms for ${startTime} - ${endTime}`);

  await Timetable.fetchRawTimetableData(validRooms, startDate, endDate, 'location')
  // they may have changed how these responses look.
    .then(async (res) => {
      res = res.CategoryEvents
      let freeRooms = []
      let foundEvents = {}

      res.forEach(roomObject => {
        let roomName = roomObject.Name.split('.')[1]
        let events = roomObject.Results

        if (events.length > 0) {
          foundEvents[roomName] = []
          events.forEach(
            event => {
              foundEvents[roomName].push(`\`${event.StartDateTime.slice(11, 16)} - ${event.EndDateTime.slice(11, 16)}\` ${event.Name}`)
            }
          )
          foundEvents[roomName] = foundEvents[roomName].sort()
        } else {
          freeRooms.push(roomName)
        };
      });

      if (foundEvents != {}) {
        Object.entries(foundEvents).forEach(
          room => {
            outputEmbed.addFields({ name: room[0], value: room[1].join('\n'), inline: true })
          }
        )
      }

      outputEmbed.addFields({ name: `These rooms are free from ${startTime}-${endTime}`, value: freeRooms.join('\n') })
    })
    .catch(() => {
      err => {
        console.error(err)
      }
    });
  const embedsToSend = (!errorEmbed.data.fields) ? [outputEmbed] : [errorEmbed, outputEmbed];
  return embedsToSend
};

exported = {
  generateTimeRange, checkRoom
};

module.exports = exported;