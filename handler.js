// handler.js

const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis();
const { Client } = require('@opensearch-project/opensearch');
const client = new Client({
  node: 'https://search-kinesis-test-tppuytne62s64vh4e3njkjkyqi.us-east-1.es.amazonaws.com',
  auth: {
    username: 'admin',
    password: 'Allgs_w1997'
  },
  ssl: {
    // Below options are necessary if your OpenSearch is using self-signed certificates
    rejectUnauthorized: false // Do not use this in production, get a valid SSL certificate
  }
});


async function indexDocument(indexName, document) {
  try {
    const response = await client.index({
      index: indexName,
      body: document
    });
    console.log('Document indexed:', response);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}


module.exports.producer = async (event) => {
  let body = JSON.parse(event.body);

  let params = {
    StreamName: 'kinesis-demo-stream-dev',
    Data: JSON.stringify(body),
    PartitionKey: '1' 
  };

  await kinesis.putRecord(params).promise();

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Data sent to Kinesis Data Stream'
    })
  };
};

module.exports.consumer = async (event) => {
  

  for (const record of event.Records) {
    let payload = Buffer.from(record.kinesis.data, 'base64').toString('utf-8');
    try {
      await indexDocument('purchase_info', payload);
    } catch (error) {
      console.error('Error indexing document:', error);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Data processed from Kinesis'
    })
  };
};

// It decodes the Base64-encoded data.
// It attempts to parse the data as JSON.
// If parsing fails, it marks the record as ProcessingFailed.
// If the log should be filtered out (as determined by the shouldFilterOutLog function), it marks the record as Dropped.
// Otherwise, it transforms the log data (using the transformLogData function) and marks the record as Ok.
module.exports.processLogs = async (event) => {
  

  try {
    const output = event.records.map((record) => {
      const payload = Buffer.from(record.data, 'base64').toString('utf8');
      let parsedPayload;

      try {
        parsedPayload = JSON.parse(payload);
      } catch (error) {
        console.error('Failed to parse record:', payload);
        return {
          recordId: record.recordId,
          result: 'ProcessingFailed',
        };
      }

      // Filter or transform the log data as needed
      if (shouldFilterOutLog(parsedPayload)) {
        return {
          recordId: record.recordId,
          result: 'Dropped',
        };
      }

      const transformedPayload = transformLogData(parsedPayload);
      const transformedData = Buffer.from(JSON.stringify(transformedPayload)).toString('base64');

      return {
        recordId: record.recordId,
        result: 'Ok',
        data: transformedData,
      };
    });

    console.log('Processing completed. ', JSON.stringify(output));
    return { records: output };
  } catch (error) {
    console.error('Error processing records:', error);
    throw error;
  }
};

function shouldFilterOutLog(logData) {
  
  if (logData.processedOnce === true){
    console.log('Filtered out log data: ', logData);
    return true
  }else{
    console.log('Log data is not filtered out: ', logData);
    return false;
  }
}

function transformLogData(logData) {
  logData.processedTimestamp = Date.now();
  logData.processedOnce = true;
  return {
    ...logData,
    processedTimestamp: Date.now(),
  };
}


