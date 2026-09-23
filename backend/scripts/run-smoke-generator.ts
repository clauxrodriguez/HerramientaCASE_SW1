import { generateSpringBootProject } from '../src/generator/springBootGenerator';
import * as fs from 'fs';

async function run() {
  try {
    const uml = {
      package: 'com.example.demo',
      classes: [
        // Class with only id to reproduce PedidoRequest empty-DTO case
        {
          name: 'Pedido',
          attributes: [
            { name: 'id', type: 'Long', isId: true }
          ],
          relations: []
        },
        {
          name: 'Product',
          attributes: [
            { name: 'id', type: 'Long', isId: true },
            { name: 'name', type: 'String' }
          ],
          relations: []
        }
      ]
    } as any;

    console.log('Starting generation...');
    const zip = await generateSpringBootProject(uml);
    const outPath = 'out-smoke.zip';
    fs.writeFileSync(outPath, zip);
    console.log('Wrote', outPath);
  } catch (err) {
    console.error('Error running generator:', err);
    process.exit(1);
  }
}

run();
