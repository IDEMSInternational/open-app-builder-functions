import type { Response } from 'express'

// Consistent response envelope
interface ApiResponse {
    success: boolean;
    message: string;
    data?: any
    error?: {
        status?: number;
        details?: any;
    };
}

const ERROR_RESPONSES = {
    UNAUTHORIZED: { status: 401, message: "Unauthorized" },
    METHOD_NOT_ALLOWED: { status: 405, message: 'Method Not Allowed' },
    INVALID_PARAMS: { status: 422, message: 'Invalid Params' },
    DATA_ERROR: { status: 422, message: 'Data Error' },
    SERVER_MISCONFIGURATION: { status: 500, message: 'Server Misconfiguration' },
    INTERNAL_ERROR: { status: 500, message: 'Internal Error' },
}

const SUCCESS_RESPONSES = {
    USER_ADDED: { status: 201, message: 'User added to group' },
    USER_EXISTING: { status: 200, message: 'User already in group' }
}

type ErrorResponseType = keyof typeof ERROR_RESPONSES

type SuccessResponseType = keyof typeof SUCCESS_RESPONSES

export function errorResponse(res: Response, type: ErrorResponseType, details?: any) {
    const { status, message } = ERROR_RESPONSES[type]
    const apiRes: ApiResponse = { success: false, message, error: { status, details } }
    res.status(status).json(apiRes)
}

export function successResponse(res: Response, type: SuccessResponseType, data?: any) {
    const { status, message } = SUCCESS_RESPONSES[type]
    const apiRes: ApiResponse = { success: true, message, data }
    res.status(status).json(apiRes)
}