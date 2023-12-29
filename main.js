const pup = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const { NodeHtmlMarkdown } = require('node-html-markdown');
const fs = require('fs');
const chalk = require('chalk');
const config = require('./utils/config');
const { changeLinks, downloadImages, delay } = require('./utils/func');
pup.use(StealthPlugin());

async function createData() {
  try {
    if (!directoryExists('./data')) {
      fs.mkdir('./data', (err) => {
        if (err) console.log(chalk.gray(`[-] Data directory did not created!`));
        else console.log(chalk.bold.green(`[+] Data directory is created`));
      });
    }
    await delay(1);
    if (!directoryExists(`./data/${config.directory}`)) {
      fs.mkdir(`./data/${config.directory}`, (err) => {
        if (err)
          console.log(chalk.gray(`[-] Project directory did not created!`));
        else console.log(chalk.bold.green(`[+] Project directory is created`));
      });
    }
  } catch (err) {
    console.log(chalk.gray(`[-] Data directory did not created!`));
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
      else console.log(chalk.bold.green('[+] You file is created.'));
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
    console.log(chalk.yellow(`[*] Visiting the SignIn page`));
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
    console.log(chalk.yellow(`[*] Submiting...`));
    await page.click('input[name="commit"]');
    // wait for 5 seconds
    await page.waitForTimeout(2000);
    // scripe the project
    console.log(chalk.yellow(`[*] Visiting the Project page`));
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
  // download the images from mark down code and change the urls
  let description = await downloadImages(descriptionMark);
  description = await changeLinks(page, description);

  // get the project tasks
  const tasks = await page.evaluate(() => {
    const tasks = Array.from(document.querySelectorAll('.task-card'));
    const tasksHtml = tasks.map((task) => {
      task.removeChild(task.querySelector('.panel-footer'));
      return task.outerHTML;
    });

    return tasksHtml;
  });
  // loop over tasks and convert it into mark down code
  let tasksMark = '';
  tasks.forEach((task) => {
    tasksMark += NodeHtmlMarkdown.translate(task);
    tasksMark += `\n\n<br><br>============================================<br><br>\n\n`;
  });
  // download the images and change the urls from mark down code
  tasksMark = await downloadImages(tasksMark);
  tasksMark = await changeLinks(page, tasksMark);
  // concatenate the mark down codes
  const fullProject = `${titleMark}\n\n<br><br><br>\n\n${description}\n\n<br><br>\n\n## Tasks\n\n<br>\n\n\n${tasksMark}\n\n<br><br>[-> Abdelemjid Essaid](https://github.com/abdelemjidessaid)`;
  // make the readme file with the mark down code
  writeInAfile(`./data/${config.directory}/README.md`, fullProject);
}

main();
