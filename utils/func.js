#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const http = require('http');
const chalk = require('chalk');
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

async function changeLinks(page, markdown, project_link) {
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
        console.log(chalk.yellow(`[*] -> Visiting a short url: ${base}`));
        let realUrl = base;
        try {
          await page.goto(base, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          realUrl = await page.url();
        } catch (error) {
          console.log(chalk.white.bgRed(`[-] Can not get the real url !`));
        }
        await page.waitForTimeout(1000);
        try {
          await page.goto(project_link, { waitUntil: 'domcontentloaded' });
          console.log(chalk.cyan(`[*] <- Returned to the main page`));
        } catch (error) {
          console.log(chalk.white.bgRed(`[!] Can not go to the main page`));
          await page.goBack({ waitUntil: 'domcontentloaded' });
        }
        // replace the short url with the real one
        markdown = await markdown.replace(linkToRegular(url), realUrl);
        console.log(chalk.bold.green(`[+] MarkDown code manipulated`));
      } else {
        console.log(chalk.gray(`[-] Url do not start with slash : ${url}`));
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

async function downloadImageHttp(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    http
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

async function downloadImages(markdown, directoryName) {
  const images = findImages(markdown);
  if (images && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const millis = new Date().getTime();
      let url = findUrl(images[i])[0]
        .replace(']', '')
        .replace('(', '')
        .replace(')', '');
      if (url && url[0] === '/') url = config.website + url;
      console.log(chalk.yellow(`[*] Image url ${chalk.gray(url)}`));
      const extension = extractExt(url).split(/[\?,;&@]/)[0];
      console.log(chalk.yellow(`[*] Image extension ${chalk.gray(extension)}`));
      const dest = `./data/${directoryName}/images/${millis}${extension}`;
      // create directories
      fs.mkdir(`./data/${directoryName}/images`, (err) => {
        if (err)
          console.log(chalk.green(`[+] Images directory already exists`));
        else console.log(chalk.bold.green(`[+] Images directory is created`));
      });

      await delay(1);

      // download the image
      let downloaded = false;
      try {
        await downloadImage(url, dest)
          .then(() => {
            console.log(
              chalk.bold.green(
                `[+] Image ${chalk.bold.cyan(millis)} downloaded.`
              )
            );
            downloaded = true;
          })
          .then((err) => {
            if (err) {
              console.log(
                chalk.gray(
                  `[-] Image ${chalk.bold.cyan(millis)} did not downloaded!`
                )
              );
              downloaded = false;
            }
          });
      } catch (err) {
        if (err.code === 'ERR_INVALID_PROTOCOL') {
          await downloadImageHttp(url, dest)
            .then(() => {
              console.log(
                chalk.bold.green(
                  `[+] Image ${chalk.bold.cyan(millis)} downloaded. With HTTP`
                )
              );
              downloaded = true;
            })
            .then((err) => {
              if (err) {
                console.log(
                  chalk.gray(
                    `[-] Image ${chalk.bold.cyan(
                      millis
                    )} did not downloaded! With HTTP`
                  )
                );
                downloaded = false;
              }
            });
        } else {
          console.error(err);
        }
      }
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
        markdown = await markdown.replace(
          regex,
          `./images/${millis}${extension}`
        );
      }
    }
  }

  return markdown;
}

module.exports = { changeLinks, downloadImages, delay };
