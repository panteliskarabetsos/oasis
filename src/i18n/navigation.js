// src/i18n/navigation.js
const {createNavigation} = require('next-intl/navigation');
const {routing} = require('./routing');

const {Link, redirect, usePathname, useRouter} = createNavigation(routing);

module.exports = {
  Link,
  redirect,
  usePathname,
  useRouter
};
