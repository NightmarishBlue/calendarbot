const { readFileSync, writeFileSync } = require('fs')

const Discord = require('discord.js');
require('dotenv').config();
const scheduler = require('node-schedule');

const RoomCheck = require('./room-check.js')
const Timetable = require('./timetable.js')
const DiscordFunctions = require('./discord-functions.js')


const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.DirectMessages] });

client.on('ready', async () => {
  console.log(`${client.user.username} is online!`);

  scheduler.scheduleJob('0 6 * *', () => {timetableUpdate(false)})
  scheduler.scheduleJob('0 18 * *', () => {timetableUpdate(true)})
});

async function timetableUpdate(nextDay) {
  let { userData, channelData } = await JSON.parse(readFileSync('./user-data.json'))

  userData = await parseChannels(userData, nextDay, 'user')
  channelData = await parseChannels(channelData, nextDay, 'channel')

  writeFileSync('./user-data.json', JSON.stringify({ userData, channelData }, null, 2))
}

async function parseChannels(dataObject, nextDay, mode) {
  // This function iterates over the dict asynchronously
  // If any errors arrise on an entry, it's removed from the dict
  // The new dict is returned, to be written onto the file on disk.
  await Promise.allSettled(Object.entries(dataObject).map(async ([targetID, optionData]) => {
    if (optionData.nextDay == nextDay) {
      let targetObject
      try {
        if (mode == 'channel') {
          targetObject = await client.channels.fetch(targetID)
        } else {
          targetObject = await client.users.fetch(targetID)
        }
        sendTimetableToChannel(targetObject, await Timetable.fetchCourseData(optionData.courseCode), 1)
      } catch {
        console.error(`Failed to find ${mode} with ID '${targetID}', removing from database.`/*, err*/)
        delete dataObject[targetID]
      }
    }
  }))
  return dataObject
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply(
      'Pong!'
    );
  }

  if (commandName === 'timetable') {
    const courseCode = interaction.options.getString('course').split(' ')[0].toUpperCase();
    const courseID = await Timetable.fetchCourseData(courseCode).catch(err => {/*console.error(err)*/ });
    if (!courseID) {
      let embed = DiscordFunctions.buildErrorEmbed(commandName, `No courses found for code \`${courseCode}\``, `Did you spell it correctly?`);
      await interaction.reply({ embeds: [embed] });
      return
    };

    const shortDay = ['mon', 'tue', 'wed', 'thu', 'fri']
    const longDay = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    let day = Timetable.fetchDay();

    if (interaction.options.getString('day') || interaction.options.getString('course').split(' ')[1]) {
      day = interaction.options.getString('day') || interaction.options.getString('course').split(' ')[1];
      day = day.toLowerCase()
      if (!shortDay.includes(day) && !longDay.includes(day)) return await interaction.reply({ content: 'Please include a valid day', ephemeral: true });

      if (day.length > 3) {
        day = longDay.find(toFind => toFind == day)
        day = day.charAt(0).toUpperCase() + day.slice(1)
      } else {
        day = longDay[shortDay.indexOf(day)]
        day = day.charAt(0).toUpperCase() + day.slice(1)
      }
    }
    
    Timetable.fetchRawTimetableData(courseID, day, new Date(), 'programme', '8:00', '22:00')
      .then(async (res) => {
        res = res[0];
        if (res.CategoryEvents.length < 1) {
          let embed = DiscordFunctions.buildErrorEmbed(commandName, `No events found for \`${res.Name}\``)
          await interaction.reply({ embeds: [embed] });
          return
        }

        let embed = new Discord.EmbedBuilder()
          .setTitle(`${res.Name} timetable for ${day}`)
          .setColor('Green');

        embed = DiscordFunctions.parseEvents(res.CategoryEvents, embed)

        await interaction.reply({ embeds: [embed] });
      });
  }

  if (commandName === 'checkrooms' || commandName === 'labfree') {
    await interaction.deferReply();
    let errorEmbed = DiscordFunctions.buildErrorEmbed(commandName);
    let timeRange = interaction.options.getString('times');
    [errorEmbed, timeRange] = RoomCheck.generateTimeRange(errorEmbed, timeRange)

    let roomCodes = ['LG25', 'LG26', 'LG27', 'L101', 'L114', 'L125', 'L128', 'L129'];
    if (commandName === 'checkrooms') roomCodes = interaction.options.getString('rooms').toUpperCase().split(/\s/);
  
    const embedsToSend = await RoomCheck.checkRoom(errorEmbed, roomCodes, timeRange);
    await interaction.followUp({ embeds: embedsToSend });
  }

  if (commandName === 'updateme') {
    await interaction.deferReply({ephemeral: true})
    const userID = interaction.user.id
    let courseCode = interaction.options.getString('course').toUpperCase()
    
    try {
      courseCode = await Timetable.fetchCourseData(courseCode, 'Name')
      let { userData, channelData } = await JSON.parse(readFileSync('./user-data.json'))

      userData[userID] = {'courseCode': courseCode}
    
      let infoString = ''
      if (interaction.options.getBoolean('nextday')) {
        infoString += 'You will receive your timetable the day before at `18:00`.'
        userData[userID]['nextDay'] = true
      } else {
        infoString += 'You will receive your timetable in the morning at `6:00`.'
      }

      writeFileSync('./user-data.json', JSON.stringify({ userData, channelData }, null, 2))

      const outputEmbed = new Discord.EmbedBuilder()
        .setTitle('Successfully registered')
        .setColor('Green')
        .addFields({"name": `You will receive updates for \`${courseCode}\``, "value": infoString})

      await interaction.followUp({embeds: [outputEmbed]})
    } catch {
      await interaction.followUp({embeds: [DiscordFunctions.buildErrorEmbed(commandName, `The course '\`${courseCode}\`' was not found.`, 'Did you spell it correctly?')]})
    }
  }
});

/**
 * @param {Discord.User} target
 * @param {String} courseID
 * @param {Int} offset
 */
const sendTimetableToChannel = async function (target, courseID, offset) {
    offset = (offset) ? 1 : 0
    const day = Timetable.fetchDay(offset)
    const dateToFetch = new Date()
    dateToFetch.setDate(dateToFetch.getDate() + offset)
    // not sure of the best way to deal with the nested promise causing an unhandled error, but this one works.
    // let courseID
    // try {courseID = await Timetable.fetchCourseData(courseCode)} catch {return true}

    Timetable.fetchRawTimetableData(courseID, day, dateToFetch)
      .then(async (res) => {
        res = res[0]
        //if (res.CategoryEvents.length < 1) return

        let embed = new Discord.EmbedBuilder()
          .setTitle(`${res.Name} Timetable for ${dateToFetch.toDateString()}`)
          .setColor('Green');
        embed = DiscordFunctions.parseEvents(res.CategoryEvents, embed)
        embed.setDescription(`Times shown are in GMT+1`);
        
        target.send({ embeds: [embed] }).catch(console.error);
      }).catch(console.error());
}

client.login(process.env.BOT_TOKEN);