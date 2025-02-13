import * as Comlink from 'comlink';
import {
  type Prover as TProver,
  NotaryServer,
} from 'tlsn-js';

const remote = Comlink.wrap(new Worker(new URL('./worker.ts', import.meta.url)));
console.log(import.meta.url)

// Initialize the library in the worker
await remote.init({loggingLevel:"Debug"});

// Now you can safely create a new Prover instance
async function main() {
//   const notary = NotaryServer.from(`https://notary.pse.dev/v0.1.0-alpha.7`);
//   console.time('submit');
  
//   // Instantiate Prover after initialization
//   const prover = (await new remote.Prover({
//     serverDns: 'swapi.dev',
//   })) as TProver;

//   await prover.setup(await notary.sessionUrl());
//   const resp = await prover.sendRequest(
//     'wss://notary.pse.dev/proxy?token=swapi.dev',
//     {
//       url: 'https://swapi.dev/api/people/1',
//       method: 'GET',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: {
//         hello: 'world',
//         one: 1,
//       },
//     }
//   );

//   console.log(resp);
}

main();
