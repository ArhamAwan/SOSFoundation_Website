// Partners, reports and the gallery's albums, videos, campaign materials and press clippings share one admin pattern:
// a list on the left and an editor on the right. This file says which fields each one has.
import { PARTNER_CATEGORIES, PROGRAMMES, REPORT_TYPES } from './content';

const programme = { name: 'programme', label: 'Programme tag', kind: 'select', options: PROGRAMMES, blank: 'None' };
const show = { name: 'live', label: 'Show on the website', kind: 'status' };

export const COLLECTIONS = {
  partner: {
    base: '/admin/partners', title: 'Partners', add: 'Add partner', noun: 'partner',
    sub: 'Logos and details shown on Partnerships and Collaborations and on the Home page.',
    filter: { name: 'category', options: PARTNER_CATEGORIES },
    order: 'sort',
    fields: [
      { name: 'title', label: 'Name', kind: 'text', required: true },
      { name: 'category', label: 'Category', kind: 'select', options: PARTNER_CATEGORIES },
      { name: 'url', label: 'Website URL', kind: 'url', help: 'The partner name links here on the Partnerships page. Leave empty for no link.' },
      { name: 'sort', label: 'Display order', kind: 'number', help: 'Lower numbers come first, on the Partnerships page and in the Home page logo strip.' },
      { name: 'logo', label: 'Logo', kind: 'image', help: 'PNG with a transparent background works best.' },
      { name: 'mou', label: 'MoU signed', kind: 'check', note: 'Shows the "MoU Partner" badge.' },
      { name: 'home', label: 'Show in the Home page logo strip', kind: 'check', default: true, note: 'Partners in "SOS Group of Companies" go in the second strip.' },
      { name: 'permission', label: 'Permission to display the logo', kind: 'check', note: 'Internal record only. The brief asks for this before a logo is shown.' },
      show,
    ],
  },
  report: {
    base: '/admin/reports', title: 'Reports and Publications', add: 'Add report', noun: 'report',
    sub: 'PDF documents offered for download on the Reports and Publications page.',
    filter: { name: 'type', options: REPORT_TYPES },
    fields: [
      { name: 'title', label: 'Title', kind: 'text', required: true },
      { name: 'type', label: 'Type', kind: 'select', options: REPORT_TYPES },
      { name: 'year', label: 'Year', kind: 'year' },
      { name: 'description', label: 'Short description', kind: 'textarea' },
      { name: 'file', label: 'PDF file', kind: 'file', accept: 'pdf', help: 'PDF, up to 25 MB.' },
      { name: 'image', label: 'Cover image', kind: 'image', help: 'Optional. A photo of the cover, shown above the title.' },
      show,
    ],
  },
  album: {
    base: '/admin/gallery', tab: 'album', title: 'Gallery', add: 'New album', noun: 'album',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', required: true },
      { name: 'date', label: 'Date', kind: 'date' },
      programme,
      { name: 'image', label: 'Cover photo', kind: 'image', help: 'Shown on the Media and Gallery page.' },
      { name: 'gallery', label: 'Photos in the album', kind: 'images', help: 'Shown on the album page. Captions and credits are set on each photo in the Media library.' },
      show,
    ],
  },
  video: {
    base: '/admin/gallery', tab: 'video', title: 'Gallery', add: 'Add video', noun: 'video',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', required: true },
      { name: 'youtube', label: 'YouTube link', kind: 'youtube', help: 'The address of the video on YouTube, for example https://www.youtube.com/watch?v=…' },
      { name: 'date', label: 'Date', kind: 'date' },
      programme,
      show,
    ],
  },
  material: {
    base: '/admin/gallery', tab: 'material', title: 'Gallery', add: 'Add campaign material', noun: 'campaign material',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', required: true },
      programme,
      { name: 'file', label: 'File', kind: 'file', accept: 'any', help: 'PDF, JPG or PNG, up to 25 MB. Offered as a download.' },
      { name: 'image', label: 'Preview image', kind: 'image', help: 'Optional. Shown above the title.' },
      show,
    ],
  },
  coverage: {
    base: '/admin/gallery', tab: 'coverage', title: 'Gallery', add: 'Add press clipping', noun: 'press clipping',
    fields: [
      { name: 'title', label: 'Newspaper or website', kind: 'text', required: true },
      { name: 'event', label: 'Event it covers', kind: 'text', help: 'Clippings with the same event are shown together under it.' },
      { name: 'date', label: 'Date', kind: 'date' },
      { name: 'image', label: 'Clipping', kind: 'image', help: 'A photo or scan of the article.' },
      { name: 'url', label: 'Link to the article', kind: 'url', help: 'Optional. For articles that are also online.' },
      show,
    ],
  },
};

export const GALLERY_TABS = [['album', 'Photo albums'], ['video', 'Videos'], ['material', 'Campaign materials'], ['coverage', 'Media coverage']];

export const hereOf = (type, extra = '') => {
  const c = COLLECTIONS[type];
  const q = [c.tab && c.tab !== 'album' ? `tab=${c.tab}` : '', extra].filter(Boolean).join('&');
  return c.base + (q ? '?' + q : '');
};
