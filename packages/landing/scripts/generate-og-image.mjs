import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function generateOGImage() {
  console.log('Launching browser...')
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2, // 2x for retina quality
  })

  const htmlPath = join(__dirname, '../public/og-building-codemesh.html')
  const outputPath = join(__dirname, '../public/og-building-codemesh.png')

  console.log('Loading HTML template...')
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  console.log('Taking screenshot...')
  await page.screenshot({
    path: outputPath,
    type: 'png',
  })

  await browser.close()
  console.log(`✅ Social card generated: ${outputPath}`)
}

generateOGImage().catch(console.error)
