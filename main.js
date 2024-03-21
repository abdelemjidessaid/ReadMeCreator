const pup = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const { NodeHtmlMarkdown } = require('node-html-markdown');
const fs = require('fs');
const chalk = require('chalk');
const config = require('./utils/config');
const { changeLinks, downloadImages, delay } = require('./utils/func');
pup.use(StealthPlugin());
let directoryName = '';

async function createData() {
  try {
    if (!directoryExists('./data')) {
      fs.mkdir('./data', (err) => {
        if (err) console.log(chalk.gray(`[-] Data directory did not created!`));
        else console.log(chalk.bold.green(`[+] Data directory is created`));
      });
    }
    await delay(1);
    if (!directoryExists(`./data/${directoryName}`)) {
      fs.mkdir(`./data/${directoryName}`, (err) => {
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
      else console.log(chalk.bold.green('[+] Your file is created.'));
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
    // scrape the project
    await scripeProject(page, config.projectLink);
    // wait for 1 second and close the browser
    await page.waitForTimeout(1000);
  } catch (err) {
    console.error('Error occured:', err);
  } finally {
    await browser.close();
  }
}

async function selectField(page) {
  try {
    // click on drop down menu if it is exists
    await page.waitForSelector('#student-switch-curriculum-dropdown', {
      timeout: 10000,
    });
    console.log(chalk.yellow(`[*] Targeting the drop down menu`));
    await page.click('#student-switch-curriculum-dropdown');
    // select the field
    console.log(chalk.green(`[+] Drop down menu clicked`));
    await page.waitForSelector('.dropdown-menu', { timeout: 10000 });
    console.log(chalk.green(`[+] Options appeared`));
    const fieldTitle = await page.evaluate((num) => {
      // .dropdown-menu > li:nth-child(1) > a:nth-child(1) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)
      const span = document.querySelector(
        `.dropdown-menu > li:nth-child(${num}) > a:nth-child(1) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)`
      );
      return span
        ? span.textContent.replaceAll('\n', '').replaceAll('\t', '')
        : num === 1
        ? 'Foundation'
        : 'Sepcialization';
    }, config.field);
    console.log(
      chalk.bold.green(
        `[+] ${chalk.bold.cyan(fieldTitle.trim())} filed is selected`
      )
    );
    console.log(chalk.cyan(`[+] Trying to click on the selected filed`));
    await page.click(
      `.dropdown-menu > li:nth-child(${config.field}) > a:nth-child(1)`
    );
    console.log(
      chalk.green(`[+] Filed ${chalk.bold.cyan(fieldTitle.trim())} is clicked`)
    );
  } catch (err) {
    console.log(
      chalk.bold.gray(`[*] There is no drop down menu of specialisation`)
    );
    console.error(err);
  }
}

async function scripeProject(page, project_link) {
  // go to the main page
  await page.goto(config.website, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(1000);
  // select the field
  await selectField(page);
  // open the given project
  await page.goto(project_link, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  // create data directory if not exists
  if (config.directory === '') {
    directoryName = await page.evaluate(() => {
      const code = document.querySelector(
        '.task-card > div:nth-child(4) > div:nth-child(1) > ul:nth-child(2) > li:nth-child(2) > code:nth-child(1)'
      );
      return code ? code.textContent : null;
    });
  } else {
    directoryName = config.directory;
  }
  console.log(
    chalk.cyan(
      `[*] Directory of tasks named: ${chalk.bold.green(directoryName)}`
    )
  );

  await createData();
  // get the project name
  const title = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const html = h1.outerHTML;
    return html;
  });
  const titleMark = NodeHtmlMarkdown.translate(title);

  // get the project description
  await page.waitForSelector('#project-description', { timeout: 10000 });
  const projectDescription = await page.evaluate(() => {
    const description = document.querySelector('#project-description');
    const html = description.outerHTML;
    return html;
  });
  const descriptionMark = NodeHtmlMarkdown.translate(projectDescription);
  // download the images from mark down code and change the urls
  let description = await downloadImages(descriptionMark, directoryName);
  description = await changeLinks(page, description, project_link);

  // get the project tasks
  await page.waitForSelector('.task-card', { timeout: 10000 });
  const tasks = await page.evaluate(() => {
    const tasks = Array.from(document.querySelectorAll('.task-card'));
    const tasksHtml = tasks.map((task) => {
      try {
        task.removeChild(task.querySelector('.panel-footer'));
        const body = task.querySelector('.panel-body ');
        body.removeChild(body.querySelector('.task_progress_score_bar'));
      } catch (err) {
        console.log('[!] Nothing removed from task');
      }
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
  tasksMark = await downloadImages(tasksMark, directoryName);
  tasksMark = await changeLinks(page, tasksMark);
  // concatenate the mark down codes
  const fullProject = `${titleMark}\n\n<br><br><br>\n\n${description}\n\n<br><br>\n\n## Tasks\n\n<br>\n\n\n${tasksMark}\n\n<br><br>[-> Abdelemjid Essaid](https://github.com/abdelemjidessaid)`;
  // make the readme file with the mark down code
  writeInAfile(`./data/${directoryName}/README.md`, fullProject);
}

main();
