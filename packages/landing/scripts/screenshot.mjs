import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { basename, dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function generateScreen(htmlFile, options = {}) {
  const width = options.width || 1280
  const height = options.height || 720
  const format = options.format || 'png'

  const outputFile = basename(htmlFile, '.html') + '.' + format

  console.log(`Generating ${outputFile} (${width}x${height})...`)
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2, // 2x for retina quality
  })

  const htmlPath = join(__dirname, '../public', htmlFile)
  const outputPath = join(__dirname, '../public', outputFile)

  console.log(`Loading ${htmlFile}...`)
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  console.log('Taking screenshot...')
  await page.screenshot({
    path: outputPath,
    type: format === 'jpg' ? 'jpeg' : format,
    ...(format === 'jpg' || format === 'jpeg' ? { quality: 85 } : {}),
  })

  await browser.close()
  console.log(`✅ Generated: ${outputPath}`)
}

async function generateScreenshot() {
  console.log('🎬 Generating screenshot...\n')

  // Parse arguments
  const args = process.argv.slice(2)
  const htmlFile = args[0]

  if (!htmlFile) {
    console.error('Usage: node screenshot.mjs <html-file> [--width <width>] [--height <height>] [--format <png|jpg>]')
    process.exit(1)
  }

  const options = {}

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '')
    const value = args[i + 1]

    if (key === 'width' || key === 'height') {
      options[key] = parseInt(value, 10)
    } else if (key === 'format') {
      options[key] = value
    }
  }

  await generateScreen(htmlFile, options)

  console.log('\n🎉 Screenshot generated!')
}

generateScreenshot().catch(console.error)
