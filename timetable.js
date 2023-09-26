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
  const minute = DateObject.getMinutes() + "0";
  return (hour + ':' + minute.slice(0, 2))
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
// whoops, everythings been changed. thats all part of the end point now. 
function constructRequestBody(identities, categoryType) {
  let requestBodyTemplate = require('./new_body.json')
  //defaults to the programme type
  categoryType = (categoryType == 'programme') ? programmeIdentity : locationIdentity

  if (typeof (identities) == 'string') {
    identities = [identities]
  };

  requestBodyTemplate['CategoryTypesWithIdentities'][0]["CategoryIdentities"] = identities;
  requestBodyTemplate['CategoryTypesWithIdentities'][0]["CategoryTypeIdentity"] = categoryType;
  return requestBodyTemplate
}

// Makes a search on opentimetable for a keyword and returns the first courses result's identity
// If data is defined, we can grab that instead, such as 'Name'
async function fetchCourseData(query, data) {
  data ??= 'Identity'
  var reqPayload = {
    method: 'POST',
    uri: `https://scientia-eu-v4-api-d1-03.azurewebsites.net/api/Public/CategoryTypes/${programmeIdentity}/Categories/FilterWithCache/a1fdee6b-68eb-47b8-b2ac-a4c60c8e6177?pageNumber=1&query=${query}`,
    //uri: `https://opentimetable.dcu.ie/broker/api/CategoryTypes/${programmeIdentity}/Categories/Filter?pageNumber=1&query=${query}`,
    //headers: reqHeaders,
    json: true
  };

  // const output = await fetch(`https://opentimetable.dcu.ie/broker/api/CategoryTypes/${programmeIdentity}/Categories/Filter?pageNumber=1&query=${query}`, reqPayload)
  //   .then(res => res.json())
  //   .catch(err => (console.log(err)))
  const output = new Promise(function (resolve, reject) {
    Request(reqPayload) // Send the HTTP Request
      .then(function (res_body) {
        res_body = res_body['Results']
        if (res_body.length == 0) {
          reject(`Course identity not found with supplied course code '${query}'`)
        } else {
          resolve(res_body[0][data])
        }
      })
      .catch(function (err) { // Catch any errors
        reject(err)
      });
  }).catch(err => {throw err})
  // This is why request-promise is deprecated. 🤦
  return output
}

// This gets the raw timetable data for a given block of time. Feed it the identities, not the codes.
async function fetchRawTimetableData(identitiesToQuery, startDate, endDate, mode) {
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
      uri: `https://scientia-eu-v4-api-d1-03.azurewebsites.net/api/Public/CategoryTypes/Categories/Events/Filter/a1fdee6b-68eb-47b8-b2ac-a4c60c8e6177?startRange=${startDate}&endRange=${endDate}`,
      //uri: `https://opentimetable.dcu.ie/broker/api/categoryTypes/${categoryIdentity}/categories/events/filter`,
      //headers: reqHeaders,
      body: constructRequestBody(identitiesToQuery, mode),
      json: true
    };

    Request(reqPayload) // Send the HTTP Request
      .then(async function (res_body) {
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
        //console.error(err)
        reject(err)
      });
  })
  return output
}

// Starts a search from a module code, and returns the title of the first result
// unnecessary, since now the result does everything.
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
          reject(`Module identity not found with supplied module code '${query}'.`);
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
  weekdays, fetchDay, extractTimeFromDate, timeToString,reqHeaders, startOfWeek, constructRequestBody, fetchCourseData, fetchRawTimetableData, fetchModuleNameFromCode
}

module.exports = exported