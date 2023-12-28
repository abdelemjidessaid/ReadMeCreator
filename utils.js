#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const config = require('./config');

function findLinks(markdown) {
  const regex = /[^!]\[.*?\]\((.*?)\)/gm;
  const match = markdown.match(regex);

  return match && match.length > 0 ? match : null;
}

function findImages(markdown) {
  const regex = /!\[.*?\]\((.*?)\)/gm;
  const match = markdown.match(regex);

  return match && match.length > 0 ? match : null;
}

function findUrl(link) {
  const regex = /\]\((.*?)\)/g;
  const match = link.match(regex);

  return match ? match : null;
}

function linkToRegular(link) {
  const reg = link
    .replaceAll('/', '\\/')
    .replaceAll('?', '\\?')
    .replaceAll('*', '\\*')
    .replaceAll('.', '\\.')
    .replaceAll('+', '\\+');

  return new RegExp(reg, 'gm');
}

async function changeLinks(page, markdown) {
  const links = findLinks(markdown);
  if (links && links.length > 0) {
    for (let i = 0; i < links.length; i++) {
      const urls = findUrl(links[i]);
      const url = urls[0]
        .replace(']', '')
        .replace('(', '')
        .replace(')', '')
        .split(' ')[0];

      if (url[0] === '/') {
        const base = 'https://intranet.alxswe.com' + url;
        console.log(`[*] Visiting a short url: ${base}`);
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        const realUrl = await page.url();
        await page.goBack();
        console.log(`[+] Returned to the main page`);
        markdown = await markdown.replace(linkToRegular(url), realUrl);
        console.log(`[+] MarkDown code manipulated`);
      } else {
        console.log('Url do not start with / : ' + url);
      }
    }
  }

  return markdown;
}

function extractExt(url) {
  if (!url) return '';
  let ext = '';
  for (let i = url.lastIndexOf('.'); i < url.length; i++) {
    ext += url[i];
  }
  return ext;
}

function delay(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https
      .get(url, (response) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (error) => {
          fs.unlink(dest, () => {
            reject(error);
          });
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function downloadImages(markdown) {
  const images = findImages(markdown);
  if (images && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const url = findUrl(images[i])[0]
        .replace(']', '')
        .replace('(', '')
        .replace(')', '');
      const extension = extractExt(url);
      const dest = `./data/${config.directory}/images/${i}${extension}`;
      // create directories
      fs.mkdir(`./data/${config.directory}/images`, (err) => {
        if (err) console.log(`[-] Images directory did not created!`);
        else console.log(`[+] Images directory is created`);
      });

      await delay(1);

      // download the image
      let downloaded = false;
      await downloadImage(url, dest)
        .then(() => {
          console.log(`[+] Image ${i} downloaded.`);
          downloaded = true;
        })
        .then((err) => {
          if (err) {
            console.log(`[-] Image ${i} did not downloaded!`);
            downloaded = false;
          }
        });
      //  if the image is downloaded replace it in markdown code
      if (downloaded) {
        let reg = url;
        reg = reg
          .replaceAll('.', '\\.')
          .replaceAll('/', '\\/')
          .replaceAll('?', '\\?')
          .replaceAll('*', '\\*')
          .replaceAll('+', '\\+');
        const regex = new RegExp(reg, 'gm');
        markdown = await markdown.replace(regex, `./images/${i}${extension}`);
      }
    }
  }

  return markdown;
}

module.exports = { changeLinks, downloadImages, delay };
