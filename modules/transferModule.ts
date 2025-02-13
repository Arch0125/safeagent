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
    isSessionEnabled,
} from '@rhinestone/module-sdk'
import { baseSepolia } from 'viem/chains'
import ALLOWANCES from "../allowances.json"

export async function transferModule(toAddress:string, amount:number) {

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
    const owner2 = privateKeyToAccount('0x5b1c32040fad747da544476076de2997bbb06c39353d96a4d72b1db3e60bcc82')

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


    console.log(smartAccountClient.account.address)

    const sessionOwner = privateKeyToAccount("0x5b1c32040fad747da544476076de2997bbb06c39353d96a4d72b1db3e60bcc82")

    const session = ALLOWANCES["eth"]

    const account = getAccount({
        address: safeAccount.address,
        type: 'safe',
    })

    const smartSessions = getSmartSessionsValidator({})

    // const sessionDetails = await getEnableSessionDetails({
    //     sessions: [session],
    //     account,
    //     clients: [publicClient],
    // })

    // sessionDetails.enableSessionData.enableSession.permissionEnableSig =
    //     await owner.signMessage({
    //         message: { raw: sessionDetails.permissionEnableHash },
    //     })


    const sessionDetails = ALLOWANCES["eth"]

    const isEnabled = await isSessionEnabled({
        client: publicClient,
        account,
        permissionId: '0x1ae8c60d0072f012c2867a4cbe81e829e6d6c09433b0633a38cca966303d0b57',
      })

    console.log(isEnabled)

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
                to: toAddress,
                value: BigInt(amount),
                data: "0x00000000",
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

    const receipt1 = await pimlicoClient.waitForUserOperationReceipt({
        hash: userOpHash,
    })

    return receipt1;
}