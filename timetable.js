const Request = require('request-promise')

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] // Used to fetch the index for a day

// Magic numbers, these are used to make API queries in the URIs
// This one is used to make queries to a location and check events there
const locationIdentity = '1e042cb1-547d-41d4-ae93-a1f2c3d34538'
// This one is used to make queries for a programme/course to check events, and also to find ID of a course code.
const programmeIdentity = '241e4d36-60e0-49f8-b27e-99416745d98d'
// This is used to get a module's full title from the code.
const moduleIdentity = '525fe79b-73c3-4b5c-8186-83c652b3adcc'

// Fetch the current day, unless offset is defined. Positive goes forward, negative back.
function fetchDay(offset) {
  offset ??= 0;
  return weekdays[((new Date().getDay()) + offset) % 7]
};

// Gets current time in the syntax '2:24'. JS apparently doesn't have a native function for this.
function extractTimeFromDate(DateObject = new Date(),) {
  const hour = DateObject.getHours();
  const minute = DateObject.getMinutes();
  return (hour + ':' + minute)
};

// Convert an existing hour to 'XX:XX' syntax
function timeToString(time) {
  time = time.toString().split(':')[0]
  time = '0' + time.toString() + ':00';
  time = time.slice(-5);
  return time
}

const reqHeaders = {
  'Authorization': 'basic T64Mdy7m[',
  'Content-Type': 'application/json; charset=utf-8',
  'credentials': 'include',
  'Referer': 'https://opentimetable.dcu.ie/',
  'Origin': 'https://opentimetable.dcu.ie/'
}

function startOfWeek(dateToFetch) {
  var currentDate = new Date(dateToFetch)
  var dateDifference = currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1);

  firstDayInWeek = new Date(currentDate.setDate(dateDifference)).toISOString() // Convert our date to ISOString
  const output = firstDayInWeek.slice(0, -14).concat('T00:00:00.000Z')
  return output
  // Slice the date and add a time for midnight to the end
  // Outputs: YYYY-MM-DDT00:00:00.000Z
}

// Takes the JSON file and edits it according to the arguments, so it can be used for requests.
// Identities can be a single string or a list, start and end time must be strings (like 8:00)
function constructRequestBody(day, dateToFetch, identities, startTime, endTime) {
  let requestBodyTemplate = require('./body.json')

  if (typeof (identities) == 'string') {
    identities = [identities]
  };

  finalDayNumber = weekdays.indexOf(day)

  requestBodyTemplate['ViewOptions']['Weeks'][0]['FirstDayInWeek'] = startOfWeek(dateToFetch)
  requestBodyTemplate['ViewOptions']['Days'][0]['Name'] = day
  requestBodyTemplate['ViewOptions']['Days'][0]['DayOfWeek'] = finalDayNumber

  if (typeof (startTime) == 'string') {
    requestBodyTemplate['ViewOptions']['TimePeriods'][0]['startTime'] = startTime
    requestBodyTemplate['ViewOptions']['TimePeriods'][0]['endTime'] = endTime
  } else {
    requestBodyTemplate['ViewOptions']['TimePeriods'][0]['startTime'] = '8:00'
    requestBodyTemplate['ViewOptions']['TimePeriods'][0]['endTime'] = '22:00'
  };

  //console.log(requestBodyTemplate['ViewOptions']['TimePeriods'])
  requestBodyTemplate['CategoryIdentities'] = identities
  return requestBodyTemplate
}

// Makes a search on opentimetable for a keyword and returns the first courses result's identity
async function fetchCourseCodeIdentity(query) {
  var reqPayload = {
    method: 'POST',
    uri: `https://opentimetable.dcu.ie/broker/api/CategoryTypes/${programmeIdentity}/Categories/Filter?pageNumber=1&query=${query}`,
    headers: reqHeaders,
    json: true
  };

  const output = new Promise(function (resolve, reject) {
    Request(reqPayload) // Send the HTTP Request
      .then(function (res_body) {
        let results = res_body['Results']
        if (results.length == 0) {
          reject(`Course identity '${query}' not found with supplied course code.`)
        } else {
          resolve(res_body['Results'][0]['Identity'])
        }
      })
      .catch(function (err) { // Catch any errors
        reject(err)
      });
  })
  return output
}

// This gets the raw timetable data for a given block of time. Feed it the identities, not the codes.
async function fetchRawTimetableData(identitiesToQuery, day, dateToFetch = new Date(), mode, startTime, endTime) {
  /*  two modes, 'programme' and 'location'. programme is the default.
      programme expects one string or a list with one string, location can take a list of any size.
      times are set to 8:00 - 22:00 if startTime is not defined. */
  if (typeof (mode) != 'string') {
    mode = 'programme';
  };

  const categoryIdentity = (mode == 'programme') ? programmeIdentity : locationIdentity;

  let output = new Promise(function (resolve, reject) {
    const reqPayload = {
      method: 'POST',
      uri: `https://opentimetable.dcu.ie/broker/api/categoryTypes/${categoryIdentity}/categories/events/filter`,
      headers: reqHeaders,
      body: constructRequestBody(day, dateToFetch, identitiesToQuery, startTime, endTime),
      json: true
    };

    Request(reqPayload) // Send the HTTP Request
      .then(async function (res_body) {
        //     await Promise.all(res_body[0].CategoryEvents.map(async event => {
        //         let moduleName = await fetchModuleNameFromCode(event.Name.slice(0, 5));
        //         return event.Name = moduleName;
        //     }));

        for (let currentIndex = 0; currentIndex < res_body.length; currentIndex++) {
          await Promise.all(res_body[parseInt(currentIndex)].CategoryEvents.map(async event => {
            await fetchModuleNameFromCode(event.Name.slice(0, 5)).then(moduleName => {
              event.Name = moduleName
            }).catch(err => {
              console.error(err, `(${event.Name})`)
            });
            //return event.Name = moduleName;
          }));
        };
        resolve(res_body)
      })
      .catch(function (err) { // Catch any errors
        console.error(err)
        reject(err)
      });
  })
  return output
}

// Starts a search from a module code, and returns the title of the first result
async function fetchModuleNameFromCode(query) {
  var reqPayload = {
    method: 'POST',
    uri: `https://opentimetable.dcu.ie/broker/api/CategoryTypes/${moduleIdentity}/Categories/Filter?pageNumber=1&query=${query}`,
    headers: reqHeaders,
    json: true
  };

  return new Promise(function (resolve, reject) {
    Request(reqPayload) // Send the HTTP Request
      .then(function (res_body) {
        let results = res_body['Results'];

        if (results.length == 0) {
          reject('Course identity not found with supplied course code.');
        } else {
          resolve(res_body['Results'][0]['Name']);
        }
      })
      .catch(function (err) { // Catch any errors
        reject(err);
      });
  });
}

exported = {
  weekdays, fetchDay, extractTimeFromDate, timeToString,reqHeaders, startOfWeek, constructRequestBody, fetchCourseCodeIdentity, fetchRawTimetableData, fetchModuleNameFromCode
}

module.exports = exported