import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return mock stats for development
    const stats = {
      totalTransactions: 1243,
      totalAmount: 2845600,
      successfulPayments: 1089,
      failedPayments: 154,
      activeMembers: 356,
      openCases: 23,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      {
        totalTransactions: 0,
        totalAmount: 0,
        successfulPayments: 0,
        failedPayments: 0,
        activeMembers: 0,
        openCases: 0,
      },
      { status: 200 }
    );
  }
}
