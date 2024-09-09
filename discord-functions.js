const Discord = require('discord.js')

const maxEventNameSize = 48;

// Sorts and identifies the names of all the events from a list and adds them to the embed.
function parseEvents(eventList, embed, ignoreTutorials) {
  let finalEventCount = 0
  eventList.sort(function (a, b) {
    var aDate = new Date(a.StartDateTime).getTime(), bDate = new Date(b.StartDateTime).getTime();
    return aDate - bDate;
  });

  eventList.forEach(event => {
    if (ignoreTutorials == true && event.Description.toUpperCase() == 'TUTORIAL') return
    finalEventCount += 1
    const locations = (event.Location != null) ? event.Location.split(', ') : [];
    var locationArray = [];
    locations.forEach(location => {
      locationArray.push(location.split('.')[1]);
    })
    let eventName = event.Name
    event.ExtraProperties.some(propObject => {
      if (propObject.Name == 'Module Name') {
        eventName = propObject.Value
        return true;
      }
    });
    if (eventName.length > maxEventNameSize) eventName = eventName.slice(0, maxEventNameSize) + "…";
    embed.addFields(
      {
        name: `${eventName} (${event.Description})`,
        value: `Time: <t:${Math.floor(new Date(event.StartDateTime).getTime() / 1000)}:t> - <t:${Math.floor(new Date(event.EndDateTime).getTime() / 1000)}:t>\nLocation: ${locationArray.join(', ')}`
      },
    );
  });
  if (finalEventCount == 0) return
  return embed
};

// Creates a red embed with the addErrorField method to quickly add error info.
// Also you can put in the first field right here.
function buildErrorEmbed(commandName, fieldTitle, fieldValue) {
  let outputEmbed = new Discord.EmbedBuilder()
    .setTitle(`Error*(s)* with command: \`/${commandName}\``)
    .setColor('Red');

  outputEmbed.addErrorField = function (errorTitle, errorValue) {
    this.addFields({
      name: errorTitle,
      value: (errorValue) ? errorValue : '\u200b'
    });
    return this
  };

  if (fieldTitle) {
    outputEmbed = outputEmbed.addErrorField(fieldTitle, fieldValue)
  };
  return outputEmbed
};

exported = {
  parseEvents, buildErrorEmbed, maxEventNameSize
};

module.exports = exported;