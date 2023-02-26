const { readFileSync, writeFileSync } = require('fs')

const Discord = require('discord.js');
require('dotenv').config();
const scheduler = require('node-schedule');

const RoomCheck = require('./room-check.js')
const Timetable = require('./timetable.js')
const DiscordFunctions = require('./discord-functions.js')


const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.DirectMessages] });

// Disables the morning update.
const debug = false

client.on('ready', async () => {
  console.log(`${client.user.username} is online!`);

  // const userIDs = ['180375991133143040', '798999606288973824', '196704710072205313', '168784878681325569', '747920741638471681', '223814642080677888', '343794669492109312', '354654294269624320', '424297185950302208', '228036177817632770', '757567277909672028', '625611592024981525', '206132779866390528', '446354264478973952', '315217872005627914', '964202467095093298', '325310653130735618', '984912239817547846'];
  // const userCourses = ['CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'CASE3', 'COMSCI2', 'COMSCI1', 'COMSCI1', 'COMSCI1'];
  // const channelIDs = ['1023659560176726077']
  // const channelCourses = ['COMSCI1']

  // let users = [];
  // for await (user of userIDs) {
  //   users.push(await client.users.fetch(user));
  // }
  // console.log(`Loaded users`);

  // let channels = [];
  // for await (channel of channelIDs) {
  //   channels.push(await client.channels.fetch(channel).catch(console.error));
  // }
  // console.log(`Loaded channels`);

  let { userData, channelData } = await JSON.parse(readFileSync('./user-data.json'))

  scheduler.scheduleJob('0 6 * * *', () => {
    if (false) {
      users.forEach(user => {
        try {
          morningUpdate(user, userCourses[userIDs.indexOf(user.id)]);
        } catch (err) {
          console.error(err, user.id);
        }
      });

      channels.forEach(channel => {
        try {
          morningUpdate(channel, channelCourses[channelIDs.indexOf(channel.id)]);
        } catch (err) {
          console.error(err, channel.id);
        }
      });
    }
  })

  // console.log(userData)
  // for await ([userID, [courseCode, advance]] of Object.entries(userData)) {
  //   if (true) {
  //     let userObject
  //     try {
  //       userObject = await client.users.fetch(userID);
  //     } catch (err) {
  //       console.error(`Failed to find user with ID '${userID}', removing from database.`/*, err*/)
  //       return delete userData[userID]
  //     }
  //     morningUpdate(userObject, courseCode, advance)
  //   }
  // }
  //console.log(userData)

  userData = await morningUpdate(userData, true, 'user')
  channelData = await morningUpdate(channelData, true, 'channel')

  writeFileSync('./user-data.json', JSON.stringify({ userData, channelData }, null, 4))
});

async function morningUpdate(dataObject, nextDay, mode) {
  // This function needs to iterate over the dict asynchronously, performing this operation on each and then returning the updated dict.
  //console.log(dataObject)
  let testObject = structuredClone(dataObject)
  await Promise.allSettled(Object.entries(testObject).map(async ([targetID, optionData]) => {
    if (optionData.nextDay == nextDay) {
      let targetObject
      try {
        if (mode == 'channel') {
          targetObject = await client.channels.fetch(targetID)
        } else {
          targetObject = await client.users.fetch(targetID)
        }
        sendTimetableToChannel(targetObject, optionData.courseCode, await Timetable.fetchCourseCodeIdentity(optionData.courseCode), 1)
      } catch {
        console.error(`Failed to find ${mode} with ID '${targetID}', removing from database.`/*, err*/)
        delete testObject[targetID]
      }
    }
  }))

  console.log(testObject)

  // for (const [targetID, optionData] of Object.entries(testObject)) {
  //   try {
  //     let targetObject
  //     if (mode == "channel") {
  //       targetObject = await client.channels.fetch(targetID)
  //     } else {
  //       targetObject = await client.users.fetch(targetID)
  //     }
  //     sendTimetableToChannel(targetObject, optionData.courseCode, 1).catch(delete testObject[targetID])
  //   } catch {
  //     delete testObject[targetID]
  //   }
  // }
  // console.log(testObject)
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
    //console.log(`${interaction.user.username} used ${interaction.commandName}`)
    const courseCode = interaction.options.getString('course').split(' ')[0].toUpperCase();

    const courseID = await Timetable.fetchCourseCodeIdentity(courseCode).catch(err => {/*console.error(err)*/ });
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
          let embed = DiscordFunctions.buildErrorEmbed(commandName, `No events found for ${res.Name}`)
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
});

/**
 * @param {Discord.User} target
 * @param {String} course
 * @param {Int} offset
 */
const sendTimetableToChannel = async function (target, courseCode, courseID, offset) {
    offset = (offset) ? 1 : 0
    const day = Timetable.fetchDay(offset)
    const dateToFetch = new Date()
    dateToFetch.setDate(dateToFetch.getDate() + offset)
    //const courseID = await Timetable.fetchCourseCodeIdentity(course)
    
    Timetable.fetchRawTimetableData(courseID, day, dateToFetch)
      .then(async (res) => {
        res = res[0].CategoryEvents;
        //if (res.length < 1) return

        let embed = new Discord.EmbedBuilder()
          .setTitle(`${courseCode} Timetable for ${dateToFetch.toDateString()}`)
          .setColor('Green');
        embed = DiscordFunctions.parseEvents(res, embed)
        embed.setDescription(`Times shown are in GMT+1`);
        
        target.send({ embeds: [embed] }).catch(console.error);
      }).catch(console.error());
}

client.login(process.env.BOT_TOKEN);