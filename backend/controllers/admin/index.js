/**
 * Admin controllers — barrel export.
 * Each domain has its own module for maintainability.
 */

const inquiryController = require('./inquiryController');
const newsController = require('./newsController');
const projectsController = require('./projectsController');
const staffController = require('./staffController');
const pagesController = require('./pagesController');
const themesController = require('./themesController');
const settingsController = require('./settingsController');
const facilitiesController = require('./facilitiesController');
const guestAdminController = require('./guestAdminController');
const roomMapController = require('./roomMapController');
const systemController = require('./systemController');
const uploadController = require('./uploadController');
const restaurantController = require('./restaurantController');
const navController = require('./navController');
const cmsUsersController = require('./cmsUsersController');
const emailTemplatesController = require('./emailTemplatesController');

module.exports = {
  ...inquiryController,
  ...newsController,
  ...projectsController,
  ...staffController,
  ...pagesController,
  ...themesController,
  ...settingsController,
  ...facilitiesController,
  ...guestAdminController,
  ...roomMapController,
  ...systemController,
  ...uploadController,
  ...restaurantController,
  ...navController,
  ...cmsUsersController,
  ...emailTemplatesController,
};
