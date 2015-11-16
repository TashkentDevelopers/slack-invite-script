function getMyHost() {
  // TODO: put your slack domain here
  return "https://tashkentdevelopers.slack.com";
}

function getToken() {
  // TODO: PUT YOUR TOKEN HERE
  var token = PropertiesService.getScriptProperties().getProperty('slack_token');
  return token;
}

function getSignupChannel() {
  // TODO: PUT THE CHANNEL YOU WANT TO SEND UPDATES INTO HERE
  return '#newregistrations';
}

function onFormSubmit(e) {
  readRows(e.range.getSheet());
}

/**
 * Retrieves all the rows in the active spreadsheet that contain data
 * When going through the rows if there no value in 'invited by' then
 * sends the email field to the slack invite service.
 * For more information on using the Spreadsheet API, see
 * https://developers.google.com/apps-script/service_spreadsheet
 */
function readRows() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rows = sheet.getDataRange();
  var numRows = rows.getNumRows();
  var values = rows.getValues();

  // Sheet is a forms response sheet with 3 columns
  // 'Timestamp' 'What is your email address?' 'Invited by'

  Logger.log('Looking for rows with email but no invited by...');
  for (var i = 1; i <= numRows - 1; i++) {
    var row = values[i];
    var first_name = row[1];
    var last_name = row[2];
    var email = row[3];
    var info = row[4];
    var invited = row[5];

    if (!invited && email) {
      Logger.log('Inviting email=' + email);

      var result = invite(email, first_name, last_name);
      Logger.log(result);
      sheet.getRange(i + 1, 6).setValue(result || 'scriptbot');

      SpreadsheetApp.flush();
    }
  }
  return;
}

/**
 * obscure the full email
 */
function hideEmail(email) {
  return email.replace(/(.+)@.+$/, '$1@***');
}

/**
 * Tell the signupform channel you invited someone. This is a provides a backup
 * if signup via API dies.
 */
function sayInvited(email, first_name, last_name, inviteResponse) {
  var message;
  var options;
  var payload = getPayload();
  var result;
  var time = Math.ceil(new Date().getTime() / 1000);
  var url = getMyHost() + '/api/chat.postMessage?t=' + time;

  if (!payload) {
    return;
  }

  if (inviteResponse.ok === true) {
    message = first_name + ' ' +last_name + ' (' + hideEmail(email) + ') - invited successfully';
  } else {
    message = 'Error Inviting: ' +
      first_name + ' ' +last_name + ' (' + hideEmail(email) + ') Error:' + inviteResponse.error;
  }

  payload.channel = getSignupChannel();

  payload.text = message;
  payload.username = 'scriptbot';

  options = {
    'method'  : 'POST',
    'payload' : payload,
    'followRedirects' : true,
    'muteHttpExceptions': true
  };

  result = UrlFetchApp.fetch(url, options);

  if (result.getResponseCode() == 200) {
    Logger.log(result);
  } else {
    Logger.log('exception');
    Logger.log(result);
  }

  return;
}

/**
 * Return a payload object with the basic required information.
 */
function getPayload() {
  var payload;
  var token = getToken();
  if (token == 'fill_in_your_api_token') {
    Logger.log('You have to fill in your api token');
    return;
  }

  payload = {
    'token' : token,
    'type' : 'post'
  };

  return payload;
}

/**
 * Sends the email to the slack invite endpoint.  You need to fill in your api token
 * and the channels you want the user to be added to.
 *
*/
function invite(email, first_name, last_name) {
  var options;
  var payload = getPayload();
  var result;
  var time = Math.ceil(new Date().getTime() / 1000);
  var url = getMyHost() + '/api/users.admin.invite?t=' + time;

  if (payload === undefined || payload === null) {
    return;
  }

  payload.email = email;
  payload.first_name = first_name;
  payload.last_name = last_name;
  //payload.channels = 'C03GEGQ30';
  payload.set_active = 'true';
  payload._attempts = '1';

  options = {
    'method'  : 'POST',
    'payload' : payload,
    'followRedirects' : true,
    'muteHttpExceptions': true
  };

  result = UrlFetchApp.fetch(url, options);

  if (result.getResponseCode() == 200) {
    sayInvited(email, first_name, last_name, JSON.parse(result));
  }

  return result;
}

/**
 * Adds a custom menu to the active spreadsheet, containing a single menu item
 * for invoking the readRows() function specified above.
 * The onOpen() function, when defined, is automatically invoked whenever the
 * spreadsheet is opened.
 * For more information on using the Spreadsheet API, see
 * https://developers.google.com/apps-script/service_spreadsheet
 */
function onOpen() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var entries = [{
    name : 'Invite to Slack',
    functionName : 'readRows'
  }];
  spreadsheet.addMenu('Script Center Menu', entries);
}