'use strict';

// const aws = require('aws-sdk'); // eslint-disable-line import/no-unresolved, import/no-extraneous-dependencies
const KH = require('kinesis-handler');

const { KV_Store } = require('kv-store');
const fs = require('fs');

const conf = JSON.parse(fs.readFileSync('conf.json', 'utf8'));


// TODO Get these from a better place later
const eventSchema = require('./retail-stream-schema-ingress.json');
const productCreateSchema = require('./product-create-schema.json');
const productImageSchema = require('./product-image-schema.json');

const constants = {
  // self
  MODULE: 'product-catalog/catalog.js',
  // methods
  METHOD_PUT_PRODUCT: 'putProduct',
  METHOD_PUT_IMAGE: 'putImage',
  // resources
  TABLE_PRODUCT_CATEGORY_NAME: process.env.TABLE_PRODUCT_CATEGORY_NAME,
  TABLE_PRODUCT_CATALOG_NAME: process.env.TABLE_PRODUCT_CATALOG_NAME,
  // TODO KALEV: Make sure this parameter is passed from the environment.
  TABLE_PRODUCT_PHOTOS_NAME: process.env.TABLE_PRODUCT_PHOTOS_NAME,
};

const kh = new KH.KinesisHandler(eventSchema, constants.MODULE);

// const dynamo = new aws.DynamoDB.DocumentClient();

const impl = {
  /**
   * Put the given product in to the dynamo catalog.  Example event:
   * {
   *   "schema": "com.nordstrom/retail-stream/1-0-0",
   *   "origin": "hello-retail/product-producer-automation",
   *   "timeOrigin": "2017-01-12T18:29:25.171Z",
   *   "data": {
   *     "schema": "com.nordstrom/product/create/1-0-0",
   *     "id": "4579874",
   *     "brand": "POLO RALPH LAUREN",
   *     "name": "Polo Ralph Lauren 3-Pack Socks",
   *     "description": "PAGE:/s/polo-ralph-lauren-3-pack-socks/4579874",
   *     "category": "Socks for Men"
   *   }
   * }
   * @param event The product to put in the catalog.
   * @param complete The callback to inform of completion, with optional error parameter.
   */
  putProduct: (event, complete) => {
    const kv = new KV_Store(conf.host, conf.user, conf.pass, constants.TABLE_PRODUCT_CATEGORY_NAME);

    const updated = Date.now();
    let priorErr;
    const updateCallback = (err) => {
      if (priorErr === undefined) { // first update result
        if (err) {
          priorErr = err
        } else {
          priorErr = false
        }
      } else if (priorErr && err) { // second update result, if an error was previously received and we have a new one
        complete(`${constants.METHOD_PUT_PRODUCT} - errors updating DynamoDb: ${[priorErr, err]}`)
      } else if (priorErr || err) {
        complete(`${constants.METHOD_PUT_PRODUCT} - error updating DynamoDb: ${priorErr || err}`)
      } else { // second update result if error was not previously seen
        complete()
      }
    };
    // const dbParamsCategory = {
    //   TableName: constants.TABLE_PRODUCT_CATEGORY_NAME,
    //   Key: {
    //     category: event.data.category,
    //   },
    //   UpdateExpression: [
    //     'set',
    //     '#c=if_not_exists(#c,:c),',
    //     '#cb=if_not_exists(#cb,:cb),',
    //     '#u=:u,',
    //     '#ub=:ub',
    //   ].join(' '),
    //   ExpressionAttributeNames: {
    //     '#c': 'created',
    //     '#cb': 'createdBy',
    //     '#u': 'updated',
    //     '#ub': 'updatedBy',
    //   },
    //   ExpressionAttributeValues: {
    //     ':c': updated,
    //     ':cb': event.origin,
    //     ':u': updated,
    //     ':ub': event.origin,
    //   },
    //   ReturnValues: 'NONE',
    //   ReturnConsumedCapacity: 'NONE',
    //   ReturnItemCollectionMetrics: 'NONE',
    // };
    // dynamo.update(dbParamsCategory, updateCallback);

    // TODO KALEV - Need to explicitly reference the correct table (maybe pass to the constructor or smth).
    kv.init((initErr) => {
      if (initErr) {
        updateCallback(initErr);
      } else {
        kv.put(
          event.data.category,
          JSON.stringify({
            /* *************************************************
             *    Note: The 'created' field poses a problem in
             *  our model - an update requires a read first.
             * ************************************************* */
            // created: updated,
            // createdBy: event.origin,
            updated,
            updatedBy: event.origin,
          }),
          (putErr) => {
            if (putErr) {
              updateCallback(putErr);
            } else {
              kv.close((closeErr) => {
                if (closeErr) {
                  updateCallback(closeErr);
                } else {
                  updateCallback(null);
                }
              })
            }
          })
      }
    });


    // const dbParamsProduct = {
    //   TableName: constants.TABLE_PRODUCT_CATALOG_NAME,
    //   Key: {
    //     id: event.data.id,
    //   },
    //   UpdateExpression: [
    //     'set',
    //     '#c=if_not_exists(#c,:c),',
    //     '#cb=if_not_exists(#cb,:cb),',
    //     '#u=:u,',
    //     '#ub=:ub,',
    //     '#b=:b,',
    //     '#n=:n,',
    //     '#d=:d,',
    //     '#cat=:cat',
    //   ].join(' '),
    //   ExpressionAttributeNames: {
    //     '#c': 'created',
    //     '#cb': 'createdBy',
    //     '#u': 'updated',
    //     '#ub': 'updatedBy',
    //     '#b': 'brand',
    //     '#n': 'name',
    //     '#d': 'description',
    //     '#cat': 'category',
    //   },
    //   ExpressionAttributeValues: {
    //     ':c': updated,
    //     ':cb': event.origin,
    //     ':u': updated,
    //     ':ub': event.origin,
    //     ':b': event.data.brand,
    //     ':n': event.data.name,
    //     ':d': event.data.description,
    //     ':cat': event.data.category,
    //   },
    //   ReturnValues: 'NONE',
    //   ReturnConsumedCapacity: 'NONE',
    //   ReturnItemCollectionMetrics: 'NONE',
    // };
    // dynamo.update(dbParamsProduct, updateCallback);

    kv.init((initErr) => {
      if (initErr) {
        updateCallback(initErr);
      } else {
        kv.put(
          event.data.id,
          JSON.stringify({
            /* *************************************************
             *    Note: The 'created' field poses a problem in
             *  our model - an update requires a read first.
             * ************************************************* */
            // created: updated,
            // createdBy: event.origin,
            updated,
            updatedBy: event.origin,
            brand: event.data.brand,
            name: event.data.name,
            description: event.data.description,
            category: event.data.category,
          }),
          (putErr) => {
            if (putErr) {
              updateCallback(putErr);
            } else {
              kv.close((closeErr) => {
                if (closeErr) {
                  updateCallback(closeErr);
                } else {
                  updateCallback(null);
                }
              })
            }
          })
      }
    });
  },
  /**
   * Put the given image in to the dynamo catalog.  Example event:
   * {
   *   "schema": "com.nordstrom/retail-stream/1-0-0",
   *   "origin": "hello-retail/product-producer-automation",
   *   "timeOrigin": "2017-01-12T18:29:25.171Z",
   *   "data": {
   *     "schema": "com.nordstrom/product/image/1-0-0",
   *     "id": "4579874",
   *     "image": "erik.hello-retail.biz/i/p/4579874"
   *   }
   * }
   * @param event The product to put in the catalog.
   * @param complete The callback to inform of completion, with optional error parameter.
   */
  putImage: (event, complete) => {
    const kv = new KV_Store(conf.host, conf.user, conf.pass, constants.TABLE_PRODUCT_PHOTOS_NAME);

    const updated = Date.now();
    // const dbParamsProduct = {
    //   TableName: constants.TABLE_PRODUCT_CATALOG_NAME,
    //   Key: {
    //     id: event.data.id,
    //   },
    //   UpdateExpression: [
    //     'set',
    //     '#c=if_not_exists(#c,:c),', // TODO this probably isn't necessary since a photo should never be requested until after product create...?
    //     '#cb=if_not_exists(#cb,:cb),',
    //     '#u=:u,',
    //     '#ub=:ub,',
    //     '#i=:i',
    //   ].join(' '),
    //   ExpressionAttributeNames: {
    //     '#c': 'created',
    //     '#cb': 'createdBy',
    //     '#u': 'updated',
    //     '#ub': 'updatedBy',
    //     '#i': 'image',
    //   },
    //   ExpressionAttributeValues: {
    //     ':c': updated,
    //     ':cb': event.origin,
    //     ':u': updated,
    //     ':ub': event.origin,
    //     ':i': event.data.image,
    //   },
    //   ReturnValues: 'NONE',
    //   ReturnConsumedCapacity: 'NONE',
    //   ReturnItemCollectionMetrics: 'NONE',
    // };
    // dynamo.update(dbParamsProduct, complete)

    kv.init((initErr) => {
      if (initErr) {
        complete(initErr);
      } else {
        kv.put(
          event.data.id,
          JSON.stringify({
            /* *************************************************
             *    Note: The 'created' field poses a problem in
             *  our model - an update requires a read first.
             * ************************************************* */
            // created: updated,
            // createdBy: event.origin,
            updated,
            updatedBy: event.origin,
            image: event.data.image,
          }),
          (putErr) => {
            if (putErr) {
              complete(putErr);
            } else {
              kv.close((closeErr) => {
                if (closeErr) {
                  complete(closeErr);
                } else {
                  complete(null);
                }
              })
            }
          })
      }
    });

  },
};

kh.registerSchemaMethodPair(productCreateSchema, impl.putProduct);
kh.registerSchemaMethodPair(productImageSchema, impl.putImage);

module.exports = {
  processKinesisEvent: kh.processKinesisEvent.bind(kh),
};

console.log(`${constants.MODULE} - CONST: ${JSON.stringify(constants, null, 2)}`);
console.log(`${constants.MODULE} - ENV:   ${JSON.stringify(process.env, null, 2)}`);
