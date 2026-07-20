/** Hardcoded K2 Chicken shop info for the loyalty portal (single shop). */
export const SHOP = {
  name: 'K2 Chicken',
  phone: '8484978622',
  phoneHref: 'tel:+918484978622',
  address:
    'Shop No. 4, 24K Glitterati, New DP Rd, Kolte Patil, Vishal Nagar, Pimple Nilakh, Pimpri-Chinchwad, Maharashtra 411027',
  hoursLines: [
    'Mon — Closed',
    'Tue, Wed, Fri, Sat, Sun — 8:00 AM – 8:00 PM',
    'Thu — Half day · 8:00 AM – 1:00 PM',
  ],
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(
      'Shop No. 4, 24K Glitterati, New DP Rd, Vishal Nagar, Pimple Nilakh, Pimpri-Chinchwad, Maharashtra 411027'
    ),
  website: 'https://www.k2chicken.com',
} as const;
