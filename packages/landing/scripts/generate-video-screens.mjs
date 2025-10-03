import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function generateScreen(htmlFile, outputFile) {
  console.log(`Generating ${outputFile}...`)
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2, // 2x for retina quality
  })

  const htmlPath = join(__dirname, '../public', htmlFile)
  const outputPath = join(__dirname, '../public', outputFile)

  console.log(`Loading ${htmlFile}...`)
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  console.log('Taking screenshot...')
  await page.screenshot({
    path: outputPath,
    type: 'png',
  })

  await browser.close()
  console.log(`✅ Generated: ${outputPath}`)
}

async function generateAll() {
  console.log('🎬 Generating video screens...\n')

  await generateScreen('splash-screen.html', 'splash-screen.png')
  await generateScreen('end-credits.html', 'end-credits.png')

  console.log('\n🎉 All video screens generated!')
}

generateAll().catch(console.error)
