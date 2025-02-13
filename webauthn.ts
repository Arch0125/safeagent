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
    createWebAuthnCredential,
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
    getWebAuthnValidator,
    getWebauthnValidatorMockSignature,
    WEBAUTHN_VALIDATOR_ADDRESS,
    getWebauthnValidatorSignature,
} from '@rhinestone/module-sdk'
import { baseSepolia } from 'viem/chains'
import { PublicKey } from 'ox'
import { sign } from 'ox/WebAuthnP256'

export async function webauthn() {

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


    // You could also use the `createCredential` function from the `ox` package to create the credential.
    const credential = {
        "id": "_SIl-oSSb0XIjijgazBcVOzJ1tEaGERLENFc7RtSvHA",
        "publicKey": "0xbb810f30b73e2568b5c9981e1a7e0fee5923efe203285b69686825e9ebe605d79cb93e6e50a7a29a23b34e7b1b0a0db7448aee6f9ff5349f395ff771954604f1",
        "raw": {
            "authenticatorAttachment": "platform",
            "clientExtensionResults": {},
            "id": "_SIl-oSSb0XIjijgazBcVOzJ1tEaGERLENFc7RtSvHA",
            "rawId": "_SIl-oSSb0XIjijgazBcVOzJ1tEaGERLENFc7RtSvHA",
            "response": {
                "attestationObject": "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVikSZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAALU5dmZIhaprzr_lImKkOaIAIP0iJfqEkm9FyI4o4GswXFTsydbRGhhESxDRXO0bUrxwpQECAyYgASFYILuBDzC3PiVotcmYHhp-D-5ZI-_iAyhbaWhoJenr5gXXIlggnLk-blCnopojs057GwoNt0SK7m-f9TSfOV_3cZVGBPE",
                "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAALU5dmZIhaprzr_lImKkOaIAIP0iJfqEkm9FyI4o4GswXFTsydbRGhhESxDRXO0bUrxwpQECAyYgASFYILuBDzC3PiVotcmYHhp-D-5ZI-_iAyhbaWhoJenr5gXXIlggnLk-blCnopojs057GwoNt0SK7m-f9TSfOV_3cZVGBPE",
                "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiYWF1MHRhRGVTOFlxS2lBZmpTVzY2USIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImNyb3NzT3JpZ2luIjpmYWxzZX0",
                "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEu4EPMLc-JWi1yZgeGn4P7lkj7-IDKFtpaGgl6evmBdecuT5uUKeimiOzTnsbCg23RIrub5_1NJ85X_dxlUYE8Q",
                "publicKeyAlgorithm": -7,
                "transports": [
                    "internal"
                ]
            },
            "type": "public-key"
        }
    }

    console.log(credential)

    const { x, y, prefix } = PublicKey.from(credential.publicKey as `0x${string}` as Address);
    const validator = getWebAuthnValidator({
        pubKey: { x, y, prefix },
        authenticatorId: credential.id,
    });

    console.log(validator);

    const installOp = await smartAccountClient.installModule(validator);

    const receipt = await smartAccountClient.waitForUserOperationReceipt({
        hash: installOp,
    });

    // console.log(receipt);

    const nonce = await getAccountNonce(publicClient, {
        address: smartAccountClient.account.address,
        entryPointAddress: entryPoint07Address,
        key: encodeValidatorNonce({
            account: getAccount({
                address: smartAccountClient.account.address,
                type: "safe",
            }),
            validator: WEBAUTHN_VALIDATOR_ADDRESS,
        }),
    });

    console.log(nonce);


    const userOperation = await smartAccountClient.prepareUserOperation({
        account: smartAccountClient.account,
        calls: [
            {
                to: "0xa564cB165815937967a7d018B7F34B907B52fcFd",
                value: BigInt(0),
                data: "0x00000000",
            } // this call increments a counter on a counter contract - note that this contract might need to be deployed depending on which network this is used on
        ],
        nonce,
        signature: getWebauthnValidatorMockSignature(),
    });

    console.log(userOperation);

    const userOpHashToSign = getUserOperationHash({
        chainId: baseSepolia.id,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        userOperation,
    });

    const { metadata: webauthn, signature } = await sign({
        credentialId: credential.id,
        challenge: userOpHashToSign,
    });

    const encodedSignature = getWebauthnValidatorSignature({
        webauthn,
        signature,
        usePrecompiled: false,
    });

    userOperation.signature = encodedSignature;

    const userOpHash =
        await smartAccountClient.sendUserOperation(userOperation);

    const receipt1 = await smartAccountClient.waitForUserOperationReceipt({
        hash: userOpHash,
    });

    console.log(receipt1);
}
