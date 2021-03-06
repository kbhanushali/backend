const geocoding = require('reverse-geocoding-google');
const admin = require('firebase-admin');

const { saveNotification} = require('../modules/notification/notification.controller');

const serviceAccount = {
    "type": process.env['TYPE'],
    "project_id": process.env['PROJECT_ID'],
    "private_key_id": process.env['PRIVATE_KEY_ID'],
    "private_key": process.env['PRIVATE_KEY'],
    "client_email": process.env['CLIENT_EMAIL'],
    "client_id": process.env['CLIENT_ID'],
    "auth_uri": process.env['AUTH_URI'],
    "token_uri": process.env['TOKEN_URI'],
    "auth_provider_x509_cert_url": process.env['AUTH_URL'],
    "client_x509_cert_url": process.env['CLIENT_URL']
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env['FIREBASE_URL']
});

//Creates notification payload
async function createPayload(infectedUser, userLocationHistoryObj){
    const { lat, lng } = infectedUser;
    const infectedTs = new Date(infectedUser.timestamp);
    const userTs = new Date(userLocationHistoryObj.timestamp);
    const timeDiff = (userTs.getTime() - infectedTs.getTime())/60000; // minutes
    let visitTime;

    if (timeDiff <= 5)
        visitTime = 'just now';
    else if(timeDiff < 60)
        visitTime = `${timeDiff} minutes`;
    else if (timeDiff < 1440)// minutes in a day
        visitTime = `${parseInt(timeDiff/60)} ${parseInt(timeDiff/60) == 1 ? 'hour': 'hours'}`;
    else
        visitTime = `${parseInt(timeDiff/1440)} ${parseInt(timeDiff/1440) == 1 ? 'day': 'days'}`;

    const time  = infectedTs.getHours() > 12 ? `${infectedTs.getHours() - 12}PM` : `${infectedTs.getHours()}AM`
    return fetchAddress(lat, lng)
        .then(geocodingResponse => {
            let address = `${lat},${lng}`;
            if(geocodingResponse.results && geocodingResponse.results.length > 0 && geocodingResponse.results[0].formatted_address){
                address = geocodingResponse.results[0].formatted_address;
            }
            const payload = {
                notification: {
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                    title: `Alert: You crossed paths with someone confirmed Positive.`,
                    body: `An Anonymous person tested positive for Coronavirus visited ${address} at ${time} on ${infectedTs.getMonth() + 1}/${infectedTs.getDate()}, ${visitTime} prior to when you were there.`,
                    badge: '1',
                    sound: 'default'
                },
                data: { 
                    timestamp: userLocationHistoryObj.timestamp, 
                    address: address, 
                    lat, 
                    lng, 
                    userId: userLocationHistoryObj.userId
                },
            };
            return payload;
        })
        .catch(reason => {
            throw reason;
        });
}

//Sends notification to user mobile
function sendPush({ token, payload}) {
    saveNotification(payload.data).then(notification => {
        payload.data = { 
            ...payload.data,
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            timestamp: JSON.stringify(payload.data.timestamp),
            lat:`${payload.data.lat}`,
            lng:`${payload.data.lng}`,
            notificationId: JSON.stringify(notification._id)
        };
        console.log("SP:",payload);
        return admin
            .messaging()
            .sendToDevice(token, payload);
    }).catch(err => {
        console.log(`Error in saving notification: ${err}`);
    });
}

//Fetch address based on lat, lng 
function fetchAddress(lat, lng) {
    return new Promise((resolve, reject) => {
        let config = {
            'latitude': lat,
            'longitude': lng,
            'key': process.env['GEOCODING_API_KEY']
        };
        geocoding.location(config, (err, data) => {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

module.exports = {
    sendPush,
    createPayload
}