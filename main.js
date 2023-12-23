const pup = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const { NodeHtmlMarkdown } = require('node-html-markdown');
const fs = require('fs');
const axios = require('axios');
const config = require('./config');
pup.use(StealthPlugin());

async function createData() {
  try {
    if (!directoryExists('./data')) {
      fs.mkdir('./data', (err) => {
        if (err) throw err;
        else console.log('Data directory created');
      });
    }
  } catch (err) {
    console.log('Data directory did not created');
  }
}

function directoryExists(path) {
  try {
    const stats = fs.statSync(path);
    return stats.isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
  }
}

function writeInAfile(fileName, content) {
  try {
    fs.writeFile(fileName, content, (err) => {
      if (err) throw err;
      else console.log('[*] You file is created.');
    });
  } catch (err) {
    console.error('Error occured while write the readme file:', err);
  }
}

async function main() {
  // initialize a browser instance
  const browser = await pup.launch({
    headless: false,
    executablePath: executablePath(),
  });

  try {
    const page = await browser.newPage();
    // go to sign-in page
    await page.goto('https://intranet.alxswe.com/auth/sign_in');
    // write the email
    await page.focus('input[name="user[email]"]');
    await page.type('input[name="user[email]"]', config.email);
    // write the password
    await page.focus('input[name="user[password]"]');
    await page.type('input[name="user[password]"]', config.password);
    // wait for 1 second and go on
    await page.waitForTimeout(1000);
    // click on sign-in button
    await page.click('input[name="commit"]');
    // wait for 5 seconds
    await page.waitForTimeout(5000);
    // scripe the project
    await scripeProject(page);
    // wait for 10 seconds and close the browser
    await page.waitForTimeout(1000);
  } catch (err) {
    console.error('Error occured:', err);
  } finally {
    await browser.close();
  }
}

async function scripeProject(page) {
  // open the given project
  await page.goto(config.projectLink);
  // create data directory if not exists
  await createData();
  // get the project name
  const title = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const html = h1.outerHTML;
    return html;
  });
  const titleMark = NodeHtmlMarkdown.translate(title);

  // get the project description
  const projectDescription = await page.evaluate(() => {
    const description = document.querySelector('#project-description');
    const html = description.outerHTML;
    return html;
  });
  const descriptionMark = NodeHtmlMarkdown.translate(projectDescription);

  // get the project tasks
  const tasks = await page.evaluate(() => {
    const tasks = Array.from(document.querySelectorAll('.task-card'));
    const tasksHtml = tasks.map((task) => {
      task.removeChild(task.querySelector('.panel-footer'));
      return task.outerHTML;
    });

    return tasksHtml;
  });

  let tasksMark = '';
  tasks.forEach((task) => {
    tasksMark += NodeHtmlMarkdown.translate(task);
    tasksMark += `\n\n<br><br>============================================<br><br>\n\n`;
  });

  const fullProject = `${titleMark}\n<br><br><br>\n${descriptionMark}\n<br><br>\n\n## Tasks\n<br>\n\n\n${tasksMark}`;

  writeInAfile(
    './data/' +
      titleMark
        .replaceAll('#', '')
        .replaceAll('\\', '_')
        .replaceAll('.', '_')
        .replaceAll(' ', '_')
        .replaceAll(',', '_') +
      '.md',
    fullProject
  );
}

main();
