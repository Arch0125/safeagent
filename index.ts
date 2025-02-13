import { getAccountNonce } from 'permissionless/actions'
import { createSmartAccountClient } from 'permissionless'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { erc7579Actions } from 'permissionless/actions/erc7579'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
    toHex,
    type Address,
    type Hex,
    createPublicClient,
    http,
    type Chain,
    toBytes,
} from 'viem'
import {
    entryPoint07Address,
    getUserOperationHash,
    createPaymasterClient,
} from 'viem/account-abstraction'
import {
    getSmartSessionsValidator,
    OWNABLE_VALIDATOR_ADDRESS,
    getSudoPolicy,
    type Session,
    getAccount,
    encodeSmartSessionSignature,
    getOwnableValidatorMockSignature,
    RHINESTONE_ATTESTER_ADDRESS,
    MOCK_ATTESTER_ADDRESS,
    encodeValidatorNonce,
    getOwnableValidator,
    encodeValidationData,
    getEnableSessionDetails,
    encodeModuleInstallationData,
    getClient,
    getDeadmanSwitch,
    getTrustAttestersAction,
    getDeadmanSwitchValidatorMockSignature,
} from '@rhinestone/module-sdk'
import { baseSepolia } from 'viem/chains'

async function main() {

    const rpcUrl = "https://base-sepolia.g.alchemy.com/v2/0fxbpb4OCXkkyHhFNPBRelJsFg7XdhML"
    const bundlerUrl = "https://api.pimlico.io/v2/84532/rpc?apikey=pim_PM4crbegoMtx1XehCANf4Q"

    const publicClient = createPublicClient({
        transport: http(rpcUrl),
        chain: baseSepolia,
    })

    const pimlicoClient = createPimlicoClient({
        transport: http(bundlerUrl),
        entryPoint: {
            address: entryPoint07Address,
            version: '0.7',
        },
    })

    const paymasterClient = createPaymasterClient({
        transport: http(bundlerUrl),
    })

    const owner = privateKeyToAccount('0xbc6be7d1a74b23117855c023c9012eda33542c17a948d43e3828d7f42a231b5b')

    const ownableValidator = getOwnableValidator({
        owners: [owner.address],
        threshold: 1,
    })

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: '1.4.1',
        entryPoint: {
            address: entryPoint07Address,
            version: '0.7',
        },
        safe4337ModuleAddress: '0x7579EE8307284F293B1927136486880611F20002',
        erc7579LaunchpadAddress: '0x7579011aB74c46090561ea277Ba79D510c6C00ff',
        attesters: [
            RHINESTONE_ATTESTER_ADDRESS, // Rhinestone Attester
            MOCK_ATTESTER_ADDRESS, // Mock Attester - do not use in production
        ],
        attestersThreshold: 1,
        validators: [
            {
                address: ownableValidator.address,
                context: ownableValidator.initData,
            },
        ],
    })

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(bundlerUrl),
        paymaster: paymasterClient,
        userOperation: {
            estimateFeesPerGas: async () => {
                return (await pimlicoClient.getUserOperationGasPrice()).fast
            },
        },
    }).extend(erc7579Actions())


    const sessionOwner = privateKeyToAccount(generatePrivateKey())
 
const session: Session = {
  sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
  sessionValidatorInitData: encodeValidationData({
    threshold: 1,
    owners: [sessionOwner.address],
  }),
  salt: toHex(toBytes('0', { size: 32 })),
  userOpPolicies: [getSudoPolicy()],
  erc7739Policies: {
    allowedERC7739Content: [],
    erc1271Policies: [],
  },
  actions: [
    {
      actionTarget: '0xa564cB165815937967a7d018B7F34B907B52fcFd' as Address, // an address as the target of the session execution
      actionTargetSelector: '0x00000000' as Hex, // function selector to be used in the execution, in this case no function selector is used
      actionPolicies: [getSudoPolicy()],
    },
  ],
  chainId: BigInt(baseSepolia.id),
  permitERC4337Paymaster: true,
}

const account = getAccount({
    address: safeAccount.address,
    type: 'safe',
  })

  const smartSessions = getSmartSessionsValidator({})
   
  const sessionDetails = await getEnableSessionDetails({
    sessions: [session],
    account,
    clients: [publicClient],
  })

  sessionDetails.enableSessionData.enableSession.permissionEnableSig =
  await owner.signMessage({
    message: { raw: sessionDetails.permissionEnableHash },
  })

  const nonce = await getAccountNonce(publicClient, {
    address: safeAccount.address,
    entryPointAddress: entryPoint07Address,
    key: encodeValidatorNonce({
      account,
      validator: smartSessions,
    }),
  })

  console.log(nonce)
   
  sessionDetails.signature = getOwnableValidatorMockSignature({
    threshold: 1,
  })
   
  const userOperation = await smartAccountClient.prepareUserOperation({
    account: safeAccount,
    calls: [
      {
        to: session.actions[0].actionTarget,
        value: BigInt(0),
        data: session.actions[0].actionTargetSelector,
      },
    ],
    nonce,
    signature: encodeSmartSessionSignature(sessionDetails),
  })

  const userOpHashToSign = getUserOperationHash({
    chainId: baseSepolia.id,
    entryPointAddress: entryPoint07Address,
    entryPointVersion: '0.7',
    userOperation,
  })
   
  sessionDetails.signature = await sessionOwner.signMessage({
    message: { raw: userOpHashToSign },
  })
   
  userOperation.signature = encodeSmartSessionSignature(sessionDetails)

  const userOpHash = await smartAccountClient.sendUserOperation(userOperation)
 
const receipt = await pimlicoClient.waitForUserOperationReceipt({
  hash: userOpHash,
})

  console.log(receipt)
}

main()