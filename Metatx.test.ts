/* External imports */
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  BigNumber,
  Contract,
  ContractReceipt,
  ContractTransaction,
  providers,
  utils,
  Wallet
} from 'ethers'
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'
import { Interface, solidityKeccak256 } from 'ethers/lib/utils'
import exp from 'constants'

describe('Metatx Tests', () => {
    let Forwarder, forwarder: Contract, 
        Collection, collection: Contract, 
        admin: { address: any }, user: { address: any },
        ifc: Interface;

    beforeEach(async () => {
        [admin, user] = await ethers.getSigners();
        Collection = await ethers.getContractFactory('VennityCollection');
        collection = await Collection.deploy('Test Collection', admin.address, "cURI");
        ifc = collection.interface;
        Forwarder = await ethers.getContractFactory('Forwarder');
        forwarder = await Forwarder.deploy();
    });

    describe('Adding to whitelist', () => {
      it('User should not be on whitelist', async () => {
        const iswhitelist = await forwarder.isWhitelist(user.address);
        expect(iswhitelist).to.be.false;
      });
      it('Should add address to whitelist', async () => {
        await forwarder.addWhitelist(user.address);
        const iswhitelist = await forwarder.isWhitelist(user.address);
        expect(iswhitelist).to.be.true;
      });
    });

    describe('Executing Calls', () => {
      it('Should be the same function sig', async () => {
        const fragment = ifc.getSighash("_mint");
        expect(fragment).to.equal("0xa45e7496");
      })
      it('Should mint NFTs', async () => {
        // data - encoded like abi.encodeWithSignature
        var data = ifc.encodeFunctionData("_mint", [
          admin.address,
          "testCollection1",
          "testURI1",
          100,
          "testUUID1"
        ]);
        // invoice variable to execute call
        var invoice = [
          admin.address,
          collection.address,
          0, 0,
          data
        ];
        await forwarder.executeCall(invoice);
        let q = await collection.getSupply(0);
        expect(q).to.equal(100); // supply should be 100
        let p = await collection.balanceOf(admin.address, 0);
        expect(p).to.equal(100); // balance of address minted should be 100
      
        // see if it mints another NFT
        forwarder.addWhitelist(user.address);
        data = ifc.encodeFunctionData("_mint", [
          user.address,
          "testCollection2",
          "testURI2",
          50,
          "testUUID2"
        ]);
        invoice = [
          user.address,
          collection.address,
          0, 0,
          data
        ];
        await forwarder.executeCall(invoice);
        q = await collection.getSupply(1);
        expect(q).to.equal(50);
        p = await collection.balanceOf(user.address, 1);
        expect(p).to.equal(50);
      });
      it('Is comparing gas costs', async () => {
        // compare gas costs
        collection._mint(
          admin.address, 
          "testCollection1",
          "testURI1",
          100,
          "testUUID1"
        );
        let q = await collection.getSupply(0);
        expect(q).to.equal(100);
        let p = await collection.balanceOf(admin.address, 0);
        expect(p).to.equal(100);
        // note: minting directly from contract is slightly cheaper although this is
        //       expected as executeCall executes mint and sets variable, etc before
      });
      it('Should mint and transfer to someone not on whitelist', async () => {
        /* MINT */
        var data = ifc.encodeFunctionData("_mint", [
          admin.address,
          "testCollection1",
          "testURI1",
          100,
          "testUUID1"
        ]);
        // invoice variable to execute call
        var invoice = [
          admin.address,
          collection.address,
          0, 0,
          data
        ];
        await forwarder.executeCall(invoice);
        let q = await collection.getSupply(0);
        expect(q).to.equal(100);
        let p = await collection.balanceOf(admin.address, 0);
        expect(p).to.equal(100);
        p = await collection.balanceOf(user.address, 0);
        expect(p).to.equal(0);

        /* TRANSFER */
        data = ifc.encodeFunctionData("safeTransferFrom", [
          admin.address,
          user.address,
          0,
          50,
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ]);
        invoice = [
          admin.address,
          collection.address,
          0, 1,
          data
        ];
        await forwarder.executeCall(invoice);
        q = await collection.getSupply(0);
        expect(q).to.equal(100);
        p = await collection.balanceOf(admin.address, 0);
        expect(p).to.equal(50); 
        p = await collection.balanceOf(user.address, 0);
        expect(p).to.equal(50); 
      });
    });
});
