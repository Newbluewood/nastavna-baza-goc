/**
 * Admin controllers — barrel export.
 * Each domain has its own module for maintainability.
 */

const inquiryController   = require('./inquiryController');
const newsController      = require('./newsController');
const crudController      = require('./crudController');
const guestAdminController = require('./guestAdminController');
const roomMapController   = require('./roomMapController');
const systemController    = require('./systemController');
const uploadController    = require('./uploadController');

module.exports = {
  ...inquiryController,
  ...newsController,
  ...crudController,
  ...guestAdminController,
  ...roomMapController,
  ...systemController,
  ...uploadController
};
